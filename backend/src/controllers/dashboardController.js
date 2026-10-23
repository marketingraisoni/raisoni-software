import { config } from '../config/env.js';
import { getDatabaseHealth } from '../config/db.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_TYPE, USER_STATUS } from '../constants/user.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Lot } from '../models/Lot.js';
import { SemiPolishProcess } from '../models/SemiPolishProcess.js';
import { AssortmentPacket } from '../models/AssortmentPacket.js';
import { serializeUser } from '../serializers/userSerializer.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLocalIpAddresses, getPrimaryLanIp } from '../utils/network.js';

export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const [
    // User metrics
    totalUsers,
    activeUsers,
    inactiveUsers,
    adminCount,
    managerCount,
    staffCount,
    recentUsers,
    recentActivity,
    database,

    // Real Lot metrics
    totalLots,
    activeLots,
    closedLots,
    lotAgg,
    recentLots,
    monthlyLotsAgg,

    // Assortment Packets
    totalPackets,
    packetAgg,

    // 4P Semi-Polish
    totalProcesses,
    inProcessCount,
    returnedProcessCount,
    processAgg,
    vendorAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: USER_STATUS.ACTIVE }),
    User.countDocuments({ status: USER_STATUS.INACTIVE }),
    User.countDocuments({ userType: USER_TYPE.ADMIN }),
    User.countDocuments({ userType: USER_TYPE.MANAGER }),
    User.countDocuments({ userType: USER_TYPE.STAFF }),
    User.find().sort({ createdAt: -1 }).limit(5).lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    getDatabaseHealth(),

    // Lots
    Lot.countDocuments({ deletedAt: null }),
    Lot.countDocuments({ status: 'active', deletedAt: null }),
    Lot.countDocuments({ status: 'closed', deletedAt: null }),
    Lot.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          totalCarat: { $sum: '$totalCarat' },
          totalPcs: { $sum: '$totalPcs' },
        },
      },
    ]),
    Lot.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(5).lean(),
    Lot.aggregate([
      {
        $match: {
          deletedAt: null,
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          totalCarat: { $sum: '$totalCarat' },
          totalPcs: { $sum: '$totalPcs' },
        },
      },
      { $sort: { '_id': 1 } },
    ]),

    // Assortment Packets
    AssortmentPacket.countDocuments(),
    AssortmentPacket.aggregate([
      {
        $group: {
          _id: null,
          totalCarat: { $sum: '$carat' },
        },
      },
    ]),

    // 4P Semi-Polish
    SemiPolishProcess.countDocuments(),
    SemiPolishProcess.countDocuments({ status: 'in_process' }),
    SemiPolishProcess.countDocuments({ status: 'returned' }),
    SemiPolishProcess.aggregate([
      {
        $group: {
          _id: null,
          totalIssuedPieces: { $sum: '$issuedPieces' },
          totalIssuedCarat: { $sum: '$issuedCarat' },
          totalReturnedPieces: { $sum: { $ifNull: ['$returnedPieces', 0] } },
          totalReturnedCarat: { $sum: { $ifNull: ['$returnedCarat', 0] } },
          totalLossCarat: { $sum: { $ifNull: ['$processLossCarat', 0] } },
        },
      },
    ]),
    SemiPolishProcess.aggregate([
      {
        $group: {
          _id: '$vendorName',
          issuedCarat: { $sum: '$issuedCarat' },
          returnedCarat: { $sum: { $ifNull: ['$returnedCarat', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { issuedCarat: -1 } },
      { $limit: 4 },
    ]),
  ]);

  const lotSummary = lotAgg[0] || { totalCarat: 0, totalPcs: 0 };
  const packetSummary = packetAgg[0] || { totalCarat: 0 };
  const processSummary = processAgg[0] || {
    totalIssuedPieces: 0,
    totalIssuedCarat: 0,
    totalReturnedPieces: 0,
    totalReturnedCarat: 0,
    totalLossCarat: 0,
  };

  const overallYield =
    processSummary.totalIssuedCarat > 0
      ? Math.round(
          (processSummary.totalReturnedCarat / processSummary.totalIssuedCarat) *
            100 *
            100,
        ) / 100
      : 0;

  // 12-month Overview Bar Chart based on real lots carats
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthlyMap = new Map();
  for (const m of monthlyLotsAgg) {
    monthlyMap.set(m._id, m);
  }

  const overviewChart = monthNames.map((name, idx) => {
    const monthNum = idx + 1;
    const item = monthlyMap.get(monthNum);
    return {
      name,
      total: item ? Math.round(item.totalCarat * 100) / 100 : 0,
      pieces: item ? item.totalPcs : 0,
    };
  });

  // Recent 5 operations for Recent Sales card
  const recentSales = recentLots.map((lot, idx) => ({
    name: `Kapan ${lot.kapanNo}`,
    detail: `${(lot.totalPcs || 0).toLocaleString()} Pieces • ${lot.status === 'active' ? 'Active Lot' : 'Closed'}`,
    amount: `+${(lot.totalCarat || 0).toLocaleString()} Cts`,
    initials: (lot.kapanNo || 'KP').slice(0, 2).toUpperCase(),
    avatar: `/avatars/0${(idx % 5) + 1}.png`,
  }));

  // Analytics days
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const avgPcsPerDay = Math.round((lotSummary.totalPcs || 0) / 7);
  const avgCaratPerDay = Math.round(((lotSummary.totalCarat || 0) / 7) * 10) / 10;
  const analyticsChart = daysOfWeek.map((name) => ({
    name,
    clicks: avgPcsPerDay,
    uniques: Math.round(avgCaratPerDay),
  }));

  const referrers = vendorAgg.length > 0
    ? vendorAgg.map((v) => ({
        name: v._id || 'Direct',
        value: Math.round(v.issuedCarat || 0),
      }))
    : [
        { name: 'In-House 4P', value: Math.round(processSummary.totalIssuedCarat || 100) },
      ];

  const devices = [
    { name: 'Active Lots', value: activeLots },
    { name: 'Closed Lots', value: closedLots },
    { name: 'In-Process 4P', value: inProcessCount },
    { name: 'Assorted Packets', value: totalPackets },
  ];

  const primaryLanIp = getPrimaryLanIp();

  return sendSuccess(res, {
    message: API_MESSAGES.DASHBOARD.RETRIEVED,
    data: {
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        adminCount,
        managerCount,
        staffCount,

        // Real diamond manufacturing figures
        totalLots,
        activeLots,
        closedLots,
        totalCarat: Math.round(lotSummary.totalCarat * 100) / 100,
        totalRoughCarats: Math.round(lotSummary.totalCarat * 100) / 100,
        totalPieces: lotSummary.totalPcs || 0,

        totalPackets,
        totalPacketCarat: Math.round(packetSummary.totalCarat * 100) / 100,

        totalProcesses,
        inProcessCount,
        returnedProcessCount,
        totalIssuedPieces: processSummary.totalIssuedPieces,
        totalIssuedCarat: Math.round(processSummary.totalIssuedCarat * 100) / 100,
        totalReturnedPieces: processSummary.totalReturnedPieces,
        totalReturnedCarat: Math.round(processSummary.totalReturnedCarat * 100) / 100,
        totalLossCarat: Math.round(processSummary.totalLossCarat * 100) / 100,
        overallYield,
      },
      overviewChart,
      recentSales,
      recentLots: recentSales,
      analytics: {
        chart: analyticsChart,
        totalPieces: (lotSummary.totalPcs || 0).toLocaleString(),
        totalCarats: `${Math.round(lotSummary.totalCarat || 0).toLocaleString()} Cts`,
        yieldRate: `${overallYield}%`,
        totalPackets: `${totalPackets} Packets`,
        totalClicks: (lotSummary.totalPcs || 0).toLocaleString(),
        uniqueVisitors: `${Math.round(lotSummary.totalCarat || 0).toLocaleString()} Cts`,
        bounceRate: `${overallYield}%`,
        avgSession: `${totalPackets} Packets`,
        referrers,
        devices,
      },
      recentUsers: recentUsers.map(serializeUser),
      recentActivity,
      serverInfo: {
        appName: config.appName,
        version: config.appVersion,
        port: config.port,
        primaryLanIp,
        lanAddresses: getLocalIpAddresses(),
        clientIp: req.ip || req.socket.remoteAddress,
        apiUrl: `http://${primaryLanIp}:${config.port}/api`,
      },
      database,
    },
  });
});
