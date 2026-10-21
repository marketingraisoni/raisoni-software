import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { Lot } from '../models/Lot.js';
import { AssortmentPacket } from '../models/AssortmentPacket.js';
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

export const getLots = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = buildLotQuery(req.query);
  const [total, lots] = await Promise.all([
    Lot.countDocuments(query),
    Lot.find(query)
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const packetStats = lots.length
    ? await AssortmentPacket.aggregate([
        { $match: { lot: { $in: lots.map((lot) => lot._id) } } },
        {
          $group: {
            _id: '$lot',
            totalPackets: { $sum: 1 },
            totalCarat: { $sum: '$carat' },
          },
        },
      ])
    : [];
  const packetStatsByLot = new Map(
    packetStats.map((stats) => [String(stats._id), stats])
  );
  const lotsWithAssortmentStatus = lots.map((lot) => {
    const stats = packetStatsByLot.get(String(lot._id));
    const totalPackets = stats?.totalPackets ?? 0;
    const totalMilliCarat = Math.round(Number(stats?.totalCarat ?? 0) * 1000);
    const targetMilliCarat = Math.round(Number(lot.totalCarat) * 1000);

    return {
      ...lot,
      assortmentComplete:
        totalPackets === lot.totalPcs && totalMilliCarat === targetMilliCarat,
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
