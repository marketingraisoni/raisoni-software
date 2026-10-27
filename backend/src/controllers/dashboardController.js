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
    packetGradeAgg,
    packetSamples,

    // 4P Semi-Polish
    totalProcesses,
    inProcessCount,
    returnedProcessCount,
    processAgg,
    vendorAgg,

    sizeBracketsAgg,
    dailyLotsAgg,
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
    AssortmentPacket.aggregate([
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 },
          totalCarat: { $sum: '$carat' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AssortmentPacket.find()
      .select('srNo carat grade')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),

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
      { $limit: 6 },
    ]),

    // Real packet size brackets
    AssortmentPacket.aggregate([
      {
        $facet: {
          under5: [
            { $match: { carat: { $lt: 5 } } },
            { $group: { _id: null, count: { $sum: 1 }, carats: { $sum: '$carat' } } },
          ],
          from5to15: [
            { $match: { carat: { $gte: 5, $lt: 15 } } },
            { $group: { _id: null, count: { $sum: 1 }, carats: { $sum: '$carat' } } },
          ],
          from15to30: [
            { $match: { carat: { $gte: 15, $lt: 30 } } },
            { $group: { _id: null, count: { $sum: 1 }, carats: { $sum: '$carat' } } },
          ],
          from30to50: [
            { $match: { carat: { $gte: 30, $lte: 50 } } },
            { $group: { _id: null, count: { $sum: 1 }, carats: { $sum: '$carat' } } },
          ],
          over50: [
            { $match: { carat: { $gt: 50 } } },
            { $group: { _id: null, count: { $sum: 1 }, carats: { $sum: '$carat' } } },
          ],
        },
      },
    ]),

    // Real 7-day daily activity
    Lot.aggregate([
      {
        $match: {
          deletedAt: null,
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalCarat: { $sum: '$totalCarat' },
          totalPcs: { $sum: '$totalPcs' },
        },
      },
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
    detail: `${(lot.totalPcs || 0).toLocaleString()} Pkt • ${lot.status === 'active' ? 'Active Lot' : 'Closed'}`,
    amount: `+${(lot.totalCarat || 0).toLocaleString()} Cts`,
    initials: (lot.kapanNo || 'KP').slice(0, 2).toUpperCase(),
    avatar: `/avatars/0${(idx % 5) + 1}.png`,
  }));

  // Real 7-day activity chart
  const dailyLotsMap = new Map();
  for (const d of (dailyLotsAgg || [])) {
    dailyLotsMap.set(d._id, d);
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const analyticsChart = [];
  for (let i = 6; i >= 0; i--) {
    const dateObj = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateKey = dateObj.toISOString().slice(0, 10);
    const dayName = dayNames[dateObj.getDay()];
    const entry = dailyLotsMap.get(dateKey);
    analyticsChart.push({
      name: dayName,
      clicks: entry ? entry.totalPcs || 0 : 0,
      uniques: entry ? Math.round(entry.totalCarat * 100) / 100 : 0,
    });
  }

  const referrers = (vendorAgg && vendorAgg.length > 0)
    ? vendorAgg.map((v) => ({
        name: v._id || 'In-House',
        value: Math.round(v.issuedCarat || 0),
      }))
    : [];

  const devices = [
    { name: 'Active Lots', value: activeLots },
    { name: 'Closed Lots', value: closedLots },
    { name: 'In-Process 4P', value: inProcessCount },
    { name: 'Assorted Packets', value: totalPackets },
  ];

  const primaryLanIp = getPrimaryLanIp();

  // Real assortment grade breakdown
  const totalPacketCarat = Math.round((packetSummary.totalCarat || 0) * 100) / 100;
  const gradeDistribution = (packetGradeAgg && packetGradeAgg.length > 0)
    ? packetGradeAgg.map((g) => ({
        name: `Grade ${g._id || 'A'}`,
        value: Math.round(g.totalCarat * 100) / 100,
        count: g.count,
      }))
    : [];

  // Real size category brackets from DB aggregation
  const sbResult = (sizeBracketsAgg && sizeBracketsAgg[0]) || {};
  const sizeBrackets = [
    {
      range: '< 5 Cts',
      count: sbResult.under5?.[0]?.count || 0,
      carats: Math.round((sbResult.under5?.[0]?.carats || 0) * 100) / 100,
    },
    {
      range: '5-15 Cts',
      count: sbResult.from5to15?.[0]?.count || 0,
      carats: Math.round((sbResult.from5to15?.[0]?.carats || 0) * 100) / 100,
    },
    {
      range: '15-30 Cts',
      count: sbResult.from15to30?.[0]?.count || 0,
      carats: Math.round((sbResult.from15to30?.[0]?.carats || 0) * 100) / 100,
    },
    {
      range: '30-50 Cts',
      count: sbResult.from30to50?.[0]?.count || 0,
      carats: Math.round((sbResult.from30to50?.[0]?.carats || 0) * 100) / 100,
    },
    {
      range: '> 50 Cts',
      count: sbResult.over50?.[0]?.count || 0,
      carats: Math.round((sbResult.over50?.[0]?.carats || 0) * 100) / 100,
    },
  ];

  // Scatter chart data (only real packet samples, no mock generation)
  const scatterData = (packetSamples && packetSamples.length > 0)
    ? packetSamples.map((p, idx) => ({
        x: p.srNo || idx + 1,
        y: Math.round(p.carat * 100) / 100,
        z: Math.min(Math.max(p.carat * 8, 40), 280),
        name: `Packet #${p.srNo || idx + 1}`,
        grade: p.grade || 'A',
      }))
    : [];

  // Lot Rough vs Assorted conversion comparison with real DB packet aggregation
  const recentLotIds = recentLots.map((l) => l._id);
  const lotPacketAgg = recentLotIds.length > 0
    ? await AssortmentPacket.aggregate([
        { $match: { lot: { $in: recentLotIds } } },
        {
          $group: {
            _id: '$lot',
            totalPacketCarat: { $sum: '$carat' },
            count: { $sum: 1 },
          },
        },
      ])
    : [];
  const lotPacketMap = new Map(lotPacketAgg.map((p) => [p._id.toString(), p]));

  const lotAssortmentComparison = recentLots.map((lot) => {
    const rough = Math.round((lot.totalCarat || 0) * 100) / 100;
    const packetInfo = lotPacketMap.get(lot._id.toString());
    const packetCarats = packetInfo ? Math.round(packetInfo.totalPacketCarat * 100) / 100 : 0;
    return {
      kapan: `Lot ${lot.kapanNo}`,
      roughCarat: rough,
      packetCarat: packetCarats,
      conversionPct: rough > 0 && packetCarats > 0 ? Math.round((packetCarats / rough) * 100) : 0,
    };
  });

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
        totalPacketCarat,

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
      assortmentAnalytics: {
        gradeDistribution,
        sizeBrackets,
        scatterData,
        lotAssortmentComparison,
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
