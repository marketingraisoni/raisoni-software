import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ApiError } from '../errors/ApiError.js';
import { Lot } from '../models/Lot.js';
import { AssortmentPacket } from '../models/AssortmentPacket.js';
import { Vendor } from '../models/Vendor.js';
import { SemiPolishProcess } from '../models/SemiPolishProcess.js';
import { logAudit } from '../services/auditService.js';
import { buildSemiPolishExcel } from '../services/semiPolishExcelService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta, getPagination } from '../utils/pagination.js';

function generateIssueNumber(kapanNo) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `4P-${kapanNo}-${dateStr}-${randomSuffix}`;
}

export const getVendors = asyncHandler(async (req, res) => {
  const vendors = await Vendor.find({ status: 'active', processType: '4P' })
    .sort({ name: 1 })
    .lean();

  return sendSuccess(res, {
    message: 'Vendors retrieved successfully',
    data: { vendors },
  });
});

export const createVendor = asyncHandler(async (req, res) => {
  const { name, mobile, address, gstin } = req.body;
  if (!name || !name.trim()) {
    throw ApiError.badRequest('Vendor name is required');
  }

  const existing = await Vendor.findOne({
    name: new RegExp(`^${name.trim()}$`, 'i'),
    processType: '4P',
  });
  if (existing) {
    throw ApiError.conflict('A vendor with this name already exists');
  }

  const vendor = await Vendor.create({
    name: name.trim(),
    mobile: mobile?.trim() || '',
    address: address?.trim() || '',
    gstin: gstin?.trim().toUpperCase() || '',
    processType: '4P',
    createdBy: req.user?._id,
  });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Vendor created successfully',
    data: { vendor },
  });
});

export const getEligibleLots = asyncHandler(async (req, res) => {
  const { sortBy, sortOrder } = req.query;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const allowedSortFields = {
    kapanNo: 'kapanNo',
    entryDate: 'entryDate',
    totalCarat: 'totalCarat',
    totalPcs: 'totalPcs',
  };
  const sortField = allowedSortFields[sortBy] || 'kapanNo';
  const lotSort = sortBy ? { [sortField]: sortDirection } : { kapanNo: 1 };

  const lots = await Lot.find({ deletedAt: null, status: 'active' })
    .select('kapanNo totalCarat totalPcs entryDate')
    .sort(lotSort)
    .lean();

  if (!lots.length) {
    return sendSuccess(res, {
      message: 'No eligible lots found',
      data: { lots: [] },
    });
  }

  const [packetStats, activeProcesses] = await Promise.all([
    AssortmentPacket.aggregate([
      { $match: { lot: { $in: lots.map((l) => l._id) } } },
      {
        $group: {
          _id: '$lot',
          totalPackets: { $sum: 1 },
          totalCarat: { $sum: '$carat' },
        },
      },
    ]),
    SemiPolishProcess.find({
      lot: { $in: lots.map((l) => l._id) },
      status: 'in_process',
    }).select('lot').lean(),
  ]);

  const activeLotIds = new Set(activeProcesses.map((p) => String(p.lot)));
  const packetStatsMap = new Map(packetStats.map((s) => [String(s._id), s]));

  const eligibleLots = lots.filter((lot) => {
    // Cannot be already in active 4P process
    if (activeLotIds.has(String(lot._id))) return false;

    // Must have complete packet assortment
    const stats = packetStatsMap.get(String(lot._id));
    if (!stats) return false;

    const totalPackets = stats.totalPackets ?? 0;
    const totalMilliCarat = Math.round(Number(stats.totalCarat ?? 0) * 1000);
    const targetMilliCarat = Math.round(Number(lot.totalCarat) * 1000);

    return totalPackets === lot.totalPcs && totalMilliCarat === targetMilliCarat;
  });

  return sendSuccess(res, {
    message: 'Eligible lots retrieved successfully',
    data: { lots: eligibleLots },
  });
});

export const getSemiPolishList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search, sortBy, sortOrder } = req.query;

  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    filter.$or = [{ kapanNo: regex }, { issueNo: regex }, { vendorName: regex }];
  }

  // Dynamic sorting on requested fields
  const allowedSortFields = {
    kapanNo: 'kapanNo',
    issueNo: 'issueNo',
    issueDate: 'issueDate',
    returnDate: 'returnDate',
    processLossPercentage: 'processLossPercentage',
    createdAt: 'createdAt',
  };
  const sortField = allowedSortFields[sortBy] || 'createdAt';
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortOptions = sortBy ? { [sortField]: sortDirection } : { createdAt: -1 };

  const [total, processes, activeCount, completedCount, lossAgg] = await Promise.all([
    SemiPolishProcess.countDocuments(filter),
    SemiPolishProcess.find(filter)
      .populate('issuedBy', 'name username')
      .populate('receivedBy', 'name username')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    SemiPolishProcess.countDocuments({ status: 'in_process' }),
    SemiPolishProcess.countDocuments({ status: 'returned' }),
    SemiPolishProcess.aggregate([
      { $match: { status: 'returned', processLossCarat: { $gt: 0 } } },
      { $group: { _id: null, totalLoss: { $sum: '$processLossCarat' } } },
    ]),
  ]);

  const totalLossCarat = lossAgg[0]?.totalLoss ?? 0;

  return sendSuccess(res, {
    message: '4P Semi-Polish records retrieved successfully',
    data: {
      processes,
      pagination: createPaginationMeta({ page, limit, total }),
      metrics: {
        activeCount,
        completedCount,
        totalLossCarat: Math.round(totalLossCarat * 1000) / 1000,
      },
    },
  });
});

export const getSemiPolishById = asyncHandler(async (req, res) => {
  const process = await SemiPolishProcess.findById(req.params.id)
    .populate('vendor')
    .populate('lot')
    .populate('issuedBy', 'name username')
    .populate('receivedBy', 'name username')
    .lean();

  if (!process) {
    throw ApiError.notFound('4P Semi-Polish record not found');
  }

  return sendSuccess(res, {
    message: '4P Semi-Polish record retrieved successfully',
    data: { process },
  });
});

export const exportSemiPolishRecord = asyncHandler(async (req, res) => {
  const process = await SemiPolishProcess.findById(req.params.id)
    .populate('issuedBy', 'name username')
    .populate('receivedBy', 'name username')
    .lean();

  if (!process) {
    throw ApiError.notFound('4P Semi-Polish record not found');
  }

  const workbook = buildSemiPolishExcel(process);
  const safeIssueNo = process.issueNo.replace(/[^A-Z0-9_-]/gi, '-');
  const fileName = `${safeIssueNo}-process-record.xlsx`;

  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': workbook.length,
  });
  return res.status(HTTP_STATUS.OK).send(workbook);
});

export const issueToSemiPolish = asyncHandler(async (req, res) => {
  const { lotId, vendorId, issueDate, expectedReturnDate, notes } = req.body;

  if (!lotId) throw ApiError.badRequest('Lot is required');
  if (!vendorId) throw ApiError.badRequest('Vendor is required');

  const [lot, vendor] = await Promise.all([
    Lot.findOne({ _id: lotId, deletedAt: null }),
    Vendor.findById(vendorId),
  ]);

  if (!lot) throw ApiError.notFound('Lot not found');
  if (!vendor) throw ApiError.notFound('Vendor not found');

  // Verify not already active in 4P
  const existingActive = await SemiPolishProcess.findOne({
    lot: lot._id,
    status: 'in_process',
  });
  if (existingActive) {
    throw ApiError.conflict(`Lot ${lot.kapanNo} is already currently issued to 4P`);
  }

  // Fetch packets for snapshot
  const packets = await AssortmentPacket.find({ lot: lot._id })
    .sort({ srNo: 1 })
    .lean();

  const totalPackets = packets.length;
  const totalMilliCarat = packets.reduce(
    (acc, p) => acc + Math.round(Number(p.carat) * 1000),
    0
  );
  const targetMilliCarat = Math.round(Number(lot.totalCarat) * 1000);

  if (totalPackets !== lot.totalPcs || totalMilliCarat !== targetMilliCarat) {
    throw ApiError.badRequest('Cannot issue to 4P: Packet assortment is incomplete');
  }

  const packetsSnapshot = packets.map((p) => ({
    packetId: p._id,
    srNo: p.srNo,
    name: p.name,
    grade: p.grade || 'A',
    carat: p.carat,
  }));

  const issueNo = generateIssueNumber(lot.kapanNo);

  const parsedIssueDate = issueDate ? new Date(issueDate) : new Date();
  if (isNaN(parsedIssueDate.getTime())) {
    throw ApiError.badRequest('Invalid issue date format');
  }

  if (lot.entryDate) {
    const entryTime = new Date(lot.entryDate).setHours(0, 0, 0, 0);
    const issueTime = new Date(parsedIssueDate).setHours(0, 0, 0, 0);
    if (issueTime < entryTime) {
      throw ApiError.badRequest('Issue date cannot be earlier than lot entry date');
    }
  }

  let parsedExpectedDate = null;
  if (expectedReturnDate) {
    parsedExpectedDate = new Date(expectedReturnDate);
    if (isNaN(parsedExpectedDate.getTime())) {
      throw ApiError.badRequest('Invalid expected return date format');
    }
    const issueTime = new Date(parsedIssueDate).setHours(0, 0, 0, 0);
    const expectedTime = new Date(parsedExpectedDate).setHours(0, 0, 0, 0);
    if (expectedTime < issueTime) {
      throw ApiError.badRequest('Expected return date cannot be earlier than issue date');
    }
  }

  const processRecord = await SemiPolishProcess.create({
    lot: lot._id,
    kapanNo: lot.kapanNo,
    issueNo,
    vendor: vendor._id,
    vendorName: vendor.name,
    status: 'in_process',
    issueDate: parsedIssueDate,
    expectedReturnDate: parsedExpectedDate,
    issuedPieces: lot.totalPcs,
    issuedCarat: lot.totalCarat,
    packets: packetsSnapshot,
    notes: notes?.trim() || '',
    issuedBy: req.user?._id,
  });

  await logAudit({
    action: '4P_ISSUED',
    entityType: 'SemiPolishProcess',
    entityId: processRecord._id.toString(),
    user: req.user,
    req,
    details: {
      issueNo,
      kapanNo: lot.kapanNo,
      vendorName: vendor.name,
      issuedPieces: lot.totalPcs,
      issuedCarat: lot.totalCarat,
    },
  });

  broadcastEvent('semi-polish:issued', { processId: processRecord._id, lotId: lot._id });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: `Lot ${lot.kapanNo} issued to 4P successfully with Issue No ${issueNo}`,
    data: { process: processRecord },
  });
});

export const receiveFromSemiPolish = asyncHandler(async (req, res) => {
  const { returnedPieces, returnedCarat, returnDate, returnNotes } = req.body;

  const processRecord = await SemiPolishProcess.findById(req.params.id);
  if (!processRecord) {
    throw ApiError.notFound('4P Semi-Polish record not found');
  }

  if (processRecord.status !== 'in_process') {
    throw ApiError.badRequest(`This record has already been marked as ${processRecord.status}`);
  }

  const numReturnedPcs = Number(returnedPieces);
  const numReturnedCarat = Number(returnedCarat);

  if (isNaN(numReturnedPcs) || numReturnedPcs <= 0) {
    throw ApiError.badRequest('Valid returned pieces count is required');
  }

  if (isNaN(numReturnedCarat) || numReturnedCarat <= 0) {
    throw ApiError.badRequest('Valid returned carat is required');
  }

  if (numReturnedCarat > processRecord.issuedCarat) {
    throw ApiError.badRequest('Returned carat cannot exceed issued carat');
  }

  const processLossCarat = Math.round((processRecord.issuedCarat - numReturnedCarat) * 1000) / 1000;
  const processLossPercentage =
    processRecord.issuedCarat > 0
      ? Math.round((processLossCarat / processRecord.issuedCarat) * 10000) / 100
      : 0;

  const parsedReturnDate = returnDate ? new Date(returnDate) : new Date();
  if (isNaN(parsedReturnDate.getTime())) {
    throw ApiError.badRequest('Invalid return date format');
  }

  if (processRecord.issueDate) {
    const issueTime = new Date(processRecord.issueDate).setHours(0, 0, 0, 0);
    const returnTime = new Date(parsedReturnDate).setHours(0, 0, 0, 0);
    if (returnTime < issueTime) {
      throw ApiError.badRequest('Return date cannot be earlier than issue date');
    }
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (parsedReturnDate.getTime() > todayEnd.getTime()) {
    throw ApiError.badRequest('Return date cannot be in the future');
  }

  processRecord.status = 'returned';
  processRecord.returnedPieces = numReturnedPcs;
  processRecord.returnedCarat = numReturnedCarat;
  processRecord.processLossCarat = processLossCarat;
  processRecord.processLossPercentage = processLossPercentage;
  processRecord.returnDate = parsedReturnDate;
  processRecord.returnNotes = returnNotes?.trim() || '';
  processRecord.receivedBy = req.user?._id;

  await processRecord.save();

  await logAudit({
    action: '4P_RECEIVED',
    entityType: 'SemiPolishProcess',
    entityId: processRecord._id.toString(),
    user: req.user,
    req,
    details: {
      issueNo: processRecord.issueNo,
      kapanNo: processRecord.kapanNo,
      returnedPieces: numReturnedPcs,
      returnedCarat: numReturnedCarat,
      processLossCarat,
      processLossPercentage,
    },
  });

  broadcastEvent('semi-polish:returned', { processId: processRecord._id });

  return sendSuccess(res, {
    message: `Lot ${processRecord.kapanNo} received from 4P successfully`,
    data: { process: processRecord },
  });
});

export const cancelSemiPolishIssue = asyncHandler(async (req, res) => {
  const processRecord = await SemiPolishProcess.findById(req.params.id);
  if (!processRecord) {
    throw ApiError.notFound('4P Semi-Polish record not found');
  }

  if (processRecord.status !== 'in_process') {
    throw ApiError.badRequest(`Cannot cancel record with status ${processRecord.status}`);
  }

  processRecord.status = 'cancelled';
  await processRecord.save();

  await logAudit({
    action: '4P_CANCELLED',
    entityType: 'SemiPolishProcess',
    entityId: processRecord._id.toString(),
    user: req.user,
    req,
    details: { issueNo: processRecord.issueNo, kapanNo: processRecord.kapanNo },
  });

  broadcastEvent('semi-polish:cancelled', { processId: processRecord._id });

  return sendSuccess(res, {
    message: `4P Issue ${processRecord.issueNo} cancelled successfully`,
    data: { id: processRecord._id },
  });
});
