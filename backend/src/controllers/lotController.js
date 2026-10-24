import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { Lot } from '../models/Lot.js';
import { AssortmentPacket } from '../models/AssortmentPacket.js';
import { SemiPolishProcess } from '../models/SemiPolishProcess.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta, getPagination } from '../utils/pagination.js';

function buildLotQuery({ search = '', status }) {
  const query = { deletedAt: null };

  if (status && !['all', 'undefined'].includes(status)) {
    query.status = status;
  }

  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [{ kapanNo: regex }];
  }

  return query;
}

export function buildLotAssortmentProgress(lot, stats) {
  const assortedPcs = Number(stats?.totalPackets ?? 0);
  const assortedCarat = Number(Number(stats?.totalCarat ?? 0).toFixed(3));
  const assortedMilliCarat = Math.round(assortedCarat * 1000);
  const targetMilliCarat = Math.round(Number(lot.totalCarat) * 1000);
  const complete =
    assortedPcs === lot.totalPcs && assortedMilliCarat === targetMilliCarat;

  return {
    assortmentComplete: complete,
    assortmentStatus: complete
      ? 'completed'
      : assortedPcs === 0 && assortedMilliCarat === 0
        ? 'pending'
        : 'in_progress',
    assortedPcs,
    assortedCarat,
  };
}

export function buildFourPProgress(assortmentComplete, process) {
  if (!process || process.status === 'cancelled') {
    return {
      fourPStatus: 'pending',
      fourPReady: assortmentComplete,
      fourPProcessId: null,
      fourPIssueNo: '',
      fourPVendorName: '',
      fourPExpectedPackets: 0,
      fourPReturnedPackets: 0,
    };
  }

  const completed = process.status === 'returned';

  return {
    fourPStatus: completed ? 'completed' : 'in_process',
    fourPReady: false,
    fourPProcessId: String(process._id ?? process.id ?? ''),
    fourPIssueNo: String(process.issueNo ?? ''),
    fourPVendorName: String(process.vendorName ?? ''),
    fourPExpectedPackets: Number(process.plannedPacketCount ?? 0),
    fourPReturnedPackets: Number(process.returnedPacketCount ?? 0),
  };
}

export const getLots = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = buildLotQuery(req.query);
  const [total, lots] = await Promise.all([
    Lot.countDocuments(query),
    Lot.find(query)
      .select('-deletedAt')
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const lotIds = lots.map((lot) => lot._id);
  const [packetStats, fourPProcesses] = lots.length
    ? await Promise.all([
        AssortmentPacket.aggregate([
          { $match: { lot: { $in: lotIds } } },
          {
            $group: {
              _id: '$lot',
              totalPackets: { $sum: 1 },
              totalCarat: { $sum: '$carat' },
            },
          },
        ]),
        SemiPolishProcess.find({ lot: { $in: lotIds } })
          .select(
            'lot issueNo vendorName status plannedPacketCount returnedPacketCount createdAt'
          )
          .sort({ createdAt: -1 })
          .lean(),
      ])
    : [[], []];
  const packetStatsByLot = new Map(
    packetStats.map((stats) => [String(stats._id), stats])
  );
  const latestFourPProcessByLot = new Map();
  fourPProcesses.forEach((process) => {
    const lotId = String(process.lot);
    if (!latestFourPProcessByLot.has(lotId)) {
      latestFourPProcessByLot.set(lotId, process);
    }
  });
  const lotsWithAssortmentStatus = lots.map((lot) => {
    const stats = packetStatsByLot.get(String(lot._id));
    const assortmentProgress = buildLotAssortmentProgress(lot, stats);
    const fourPProcess = latestFourPProcessByLot.get(String(lot._id));
    const { deletedAt, ...rest } = lot;

    return {
      ...rest,
      ...assortmentProgress,
      ...buildFourPProgress(
        assortmentProgress.assortmentComplete,
        fourPProcess
      ),
    };
  });

  return sendSuccess(res, {
    message: API_MESSAGES.LOT.LIST_SUCCESS,
    data: {
      lots: lotsWithAssortmentStatus,
      pagination: createPaginationMeta({ page, limit, total }),
    },
  });
});

export const getLotById = asyncHandler(async (req, res) => {
  const lot = await Lot.findOne({ _id: req.params.id, deletedAt: null })
    .select('-deletedAt')
    .populate('createdBy', 'name username');
  if (!lot) throw ApiError.notFound(API_MESSAGES.LOT.NOT_FOUND);

  return sendSuccess(res, {
    message: API_MESSAGES.LOT.RETRIEVED,
    data: { lot },
  });
});

export const createLot = asyncHandler(async (req, res) => {
  // Check for duplicate kapanNo
  const existing = await Lot.findOne({
    kapanNo: req.body.kapanNo.toUpperCase(),
    deletedAt: null,
  });
  if (existing) {
    throw ApiError.conflict(API_MESSAGES.LOT.KAPAN_EXISTS);
  }

  const lot = await Lot.create({
    ...req.body,
    createdBy: req.user?._id,
  });

  await logAudit({
    action: 'LOT_CREATED',
    entityType: 'Lot',
    entityId: lot._id.toString(),
    user: req.user,
    req,
    details: { kapanNo: lot.kapanNo, totalCarat: lot.totalCarat, totalPcs: lot.totalPcs },
  });
  broadcastEvent('lot:created', { lotId: lot._id });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.LOT.CREATED,
    data: { lot },
  });
});

export const updateLot = asyncHandler(async (req, res) => {
  const lot = await Lot.findOne({ _id: req.params.id, deletedAt: null });
  if (!lot) throw ApiError.notFound(API_MESSAGES.LOT.NOT_FOUND);

  if (req.body.status === 'closed') {
    const packets = await AssortmentPacket.find({ lot: lot._id }).select('carat').lean();
    const packetMilliCarat = packets.reduce(
      (total, packet) => total + Math.round(Number(packet.carat) * 1000),
      0
    );
    const lotMilliCarat = Math.round(Number(lot.totalCarat) * 1000);

    if (packets.length !== lot.totalPcs || packetMilliCarat !== lotMilliCarat) {
      throw ApiError.badRequest(API_MESSAGES.LOT.ASSORTMENT_INCOMPLETE);
    }
  }

  lot.status = req.body.status;
  await lot.save();

  await logAudit({
    action: 'LOT_STATUS_UPDATED',
    entityType: 'Lot',
    entityId: lot._id.toString(),
    user: req.user,
    req,
    details: { kapanNo: lot.kapanNo, status: lot.status },
  });
  broadcastEvent('lot:updated', { lotId: lot._id });

  return sendSuccess(res, {
    message: API_MESSAGES.LOT.UPDATED,
    data: { lot },
  });
});

export const deleteLot = asyncHandler(async (req, res) => {
  const lot = await Lot.findOne({ _id: req.params.id, deletedAt: null });
  if (!lot) throw ApiError.notFound(API_MESSAGES.LOT.NOT_FOUND);

  lot.deletedAt = new Date();
  await lot.save();

  await logAudit({
    action: 'LOT_DELETED',
    entityType: 'Lot',
    entityId: lot._id.toString(),
    user: req.user,
    req,
    details: { kapanNo: lot.kapanNo },
  });
  broadcastEvent('lot:deleted', { lotId: lot._id });

  return sendSuccess(res, {
    message: API_MESSAGES.LOT.DELETED,
    data: { id: lot._id.toString() },
  });
});
