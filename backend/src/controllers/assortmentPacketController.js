import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { AssortmentPacket } from '../models/AssortmentPacket.js';
import { AssortmentGrade } from '../models/AssortmentGrade.js';
import { Lot } from '../models/Lot.js';
import { logAudit } from '../services/auditService.js';
import { buildAssortmentExcel } from '../services/assortmentExcelService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const toMilliCarat = (value) => Math.round(Number(value) * 1000);
const fromMilliCarat = (value) => value / 1000;
const PRIMARY_GRADE = 'A';

export function buildPacketName(kapanNo, srNo) {
  return `${kapanNo}-${srNo}${PRIMARY_GRADE}`;
}

export function buildSummary(lot, packets) {
  let totalMilliCarat = 0;

  for (const packet of packets) {
    totalMilliCarat += toMilliCarat(packet.carat);
  }

  const targetMilliCarat = toMilliCarat(lot.totalCarat);
  const totalPackets = packets.length;

  return {
    totalPackets,
    totalCarat: fromMilliCarat(totalMilliCarat),
    remainingPackets: Math.max(lot.totalPcs - totalPackets, 0),
    remainingCarat: fromMilliCarat(Math.max(targetMilliCarat - totalMilliCarat, 0)),
    complete: totalPackets === lot.totalPcs && totalMilliCarat === targetMilliCarat,
  };
}

function toPacketResponse(lot, packet) {
  const storedPacket = typeof packet.toObject === 'function' ? packet.toObject() : packet;

  return {
    id: String(storedPacket._id ?? storedPacket.id),
    srNo: storedPacket.srNo,
    name: storedPacket.name || buildPacketName(lot.kapanNo, storedPacket.srNo),
    carat: storedPacket.carat,
  };
}

export function buildPacketData(lot, packets) {
  return {
    packets: packets.map((packet) => toPacketResponse(lot, packet)),
    summary: buildSummary(lot, packets),
  };
}

async function backfillPrimaryPacketData(lot, packets) {
  const operations = packets
    .map((packet) => {
      const name = buildPacketName(lot.kapanNo, packet.srNo);
      if (packet.name === name && packet.grade === PRIMARY_GRADE) return null;

      return {
        updateOne: {
          filter: { _id: packet._id },
          update: { $set: { name, grade: PRIMARY_GRADE } },
        },
      };
    })
    .filter(Boolean);

  if (operations.length) {
    await AssortmentPacket.bulkWrite(operations);
  }
}

async function findActiveLot(lotId) {
  const lot = await Lot.findOne({ _id: lotId, deletedAt: null });
  if (!lot) throw ApiError.notFound(API_MESSAGES.LOT.NOT_FOUND);
  return lot;
}

export const getAssortmentPackets = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  const storedPackets = await AssortmentPacket.find({ lot: lot._id })
    .select('srNo name grade carat')
    .sort({ srNo: 1 })
    .lean();
  await backfillPrimaryPacketData(lot, storedPackets);
  const data = buildPacketData(lot, storedPackets);

  return sendSuccess(res, {
    message: API_MESSAGES.PACKET.LIST_SUCCESS,
    data,
  });
});

export const exportAssortmentPackets = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  const packets = await AssortmentPacket.find({ lot: lot._id })
    .select('srNo name grade carat')
    .sort({ srNo: 1 })
    .lean();
  await backfillPrimaryPacketData(lot, packets);

  const summary = buildSummary(lot, packets);
  if (!summary.complete) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.EXPORT_INCOMPLETE);
  }

  const normalizedPackets = packets.map((packet) => ({
    srNo: packet.srNo,
    name: buildPacketName(lot.kapanNo, packet.srNo),
    grade: packet.grade || 'A',
    carat: packet.carat,
  }));
  const workbook = buildAssortmentExcel(lot, normalizedPackets);
  const fileName = `${lot.kapanNo.replace(/[^A-Z0-9_-]/gi, '-')}-packet-assortment.xlsx`;

  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': workbook.length,
  });
  return res.status(HTTP_STATUS.OK).send(workbook);
});

export const createAssortmentGrade = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  if (lot.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.PACKET.LOT_CLOSED);
  }

  const existingGrade = await AssortmentGrade.findOne({
    lot: lot._id,
    grade: req.body.grade,
  });
  if (existingGrade) {
    throw ApiError.conflict(API_MESSAGES.PACKET.GRADE_EXISTS);
  }

  const [gradePlans, existingPackets] = await Promise.all([
    AssortmentGrade.find({ lot: lot._id }).select('grade targetPcs').lean(),
    AssortmentPacket.find({ lot: lot._id }).select('grade').lean(),
  ]);
  const plannedPackets = gradePlans.reduce((total, plan) => total + plan.targetPcs, 0);
  const plannedGrades = new Set(gradePlans.map((plan) => plan.grade));
  const existingGradePacketCount = existingPackets.filter(
    (packet) => packet.grade === req.body.grade
  ).length;
  const unplannedOtherPackets = existingPackets.filter(
    (packet) => !plannedGrades.has(packet.grade) && packet.grade !== req.body.grade
  ).length;

  if (req.body.targetPcs < existingGradePacketCount) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.GRADE_BELOW_CREATED);
  }
  if (plannedPackets + req.body.targetPcs + unplannedOtherPackets > lot.totalPcs) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.GRADE_PCS_LIMIT);
  }

  const gradePlan = await AssortmentGrade.create({
    lot: lot._id,
    grade: req.body.grade,
    targetPcs: req.body.targetPcs,
    createdBy: req.user?._id,
  });

  await logAudit({
    action: 'ASSORTMENT_GRADE_CREATED',
    entityType: 'AssortmentGrade',
    entityId: gradePlan._id.toString(),
    user: req.user,
    req,
    details: {
      lotId: lot._id.toString(),
      kapanNo: lot.kapanNo,
      grade: gradePlan.grade,
      targetPcs: gradePlan.targetPcs,
    },
  });
  broadcastEvent('assortment-grade:created', {
    lotId: lot._id,
    gradeId: gradePlan._id,
  });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.PACKET.GRADE_CREATED,
    data: { grade: gradePlan },
  });
});

export const updateAssortmentGrade = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  if (lot.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.PACKET.LOT_CLOSED);
  }

  const gradePlan = await AssortmentGrade.findOne({
    _id: req.params.gradeId,
    lot: lot._id,
  });
  if (!gradePlan) {
    throw ApiError.notFound(API_MESSAGES.PACKET.GRADE_NOT_FOUND);
  }

  const [gradePlans, existingPackets] = await Promise.all([
    AssortmentGrade.find({ lot: lot._id }).select('grade targetPcs').lean(),
    AssortmentPacket.find({ lot: lot._id }).select('grade').lean(),
  ]);
  const createdGradePackets = existingPackets.filter(
    (packet) => packet.grade === gradePlan.grade
  ).length;
  if (req.body.targetPcs < createdGradePackets) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.GRADE_BELOW_CREATED);
  }

  const plannedGrades = new Set(gradePlans.map((plan) => plan.grade));
  const otherPlannedPackets = gradePlans
    .filter((plan) => String(plan._id) !== String(gradePlan._id))
    .reduce((total, plan) => total + plan.targetPcs, 0);
  const unplannedPackets = existingPackets.filter(
    (packet) => !plannedGrades.has(packet.grade)
  ).length;
  if (otherPlannedPackets + req.body.targetPcs + unplannedPackets > lot.totalPcs) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.GRADE_PCS_LIMIT);
  }

  const previousTargetPcs = gradePlan.targetPcs;
  gradePlan.targetPcs = req.body.targetPcs;
  await gradePlan.save();

  await logAudit({
    action: 'ASSORTMENT_GRADE_UPDATED',
    entityType: 'AssortmentGrade',
    entityId: gradePlan._id.toString(),
    user: req.user,
    req,
    details: {
      lotId: lot._id.toString(),
      kapanNo: lot.kapanNo,
      grade: gradePlan.grade,
      previousTargetPcs,
      targetPcs: gradePlan.targetPcs,
    },
  });
  broadcastEvent('assortment-grade:updated', {
    lotId: lot._id,
    gradeId: gradePlan._id,
  });

  return sendSuccess(res, {
    message: API_MESSAGES.PACKET.GRADE_UPDATED,
    data: { grade: gradePlan },
  });
});

export const deleteAssortmentGrade = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  if (lot.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.PACKET.LOT_CLOSED);
  }

  const gradePlan = await AssortmentGrade.findOne({
    _id: req.params.gradeId,
    lot: lot._id,
  });
  if (!gradePlan) {
    throw ApiError.notFound(API_MESSAGES.PACKET.GRADE_NOT_FOUND);
  }

  const deletedPackets = await AssortmentPacket.deleteMany({
    lot: lot._id,
    grade: gradePlan.grade,
  });
  await gradePlan.deleteOne();

  await logAudit({
    action: 'ASSORTMENT_GRADE_DELETED',
    entityType: 'AssortmentGrade',
    entityId: gradePlan._id.toString(),
    user: req.user,
    req,
    details: {
      lotId: lot._id.toString(),
      kapanNo: lot.kapanNo,
      grade: gradePlan.grade,
      deletedPackets: deletedPackets.deletedCount,
    },
  });
  broadcastEvent('assortment-grade:deleted', {
    lotId: lot._id,
    gradeId: gradePlan._id,
    grade: gradePlan.grade,
  });

  return sendSuccess(res, {
    message: API_MESSAGES.PACKET.GRADE_DELETED,
    data: {
      id: gradePlan._id,
      grade: gradePlan.grade,
      deletedPackets: deletedPackets.deletedCount,
    },
  });
});

export const updateAssortmentPacket = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  if (lot.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.PACKET.LOT_CLOSED);
  }

  const packet = await AssortmentPacket.findOne({
    _id: req.params.packetId,
    lot: lot._id,
  });
  if (!packet) {
    throw ApiError.notFound(API_MESSAGES.PACKET.NOT_FOUND);
  }

  const otherPackets = await AssortmentPacket.find({
    lot: lot._id,
    _id: { $ne: packet._id },
  }).select('srNo name carat').lean();
  const otherMilliCarat = otherPackets.reduce(
    (total, currentPacket) => total + toMilliCarat(currentPacket.carat),
    0
  );
  if (otherMilliCarat + toMilliCarat(req.body.carat) > toMilliCarat(lot.totalCarat)) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.CARAT_LIMIT);
  }

  const previousCarat = packet.carat;
  packet.name = buildPacketName(lot.kapanNo, packet.srNo);
  packet.grade = PRIMARY_GRADE;
  packet.carat = req.body.carat;
  await packet.save();

  await logAudit({
    action: 'ASSORTMENT_PACKET_UPDATED',
    entityType: 'AssortmentPacket',
    entityId: packet._id.toString(),
    user: req.user,
    req,
    details: {
      lotId: lot._id.toString(),
      kapanNo: lot.kapanNo,
      srNo: packet.srNo,
      grade: packet.grade,
      previousCarat,
      carat: packet.carat,
    },
  });
  broadcastEvent('assortment-packet:updated', {
    lotId: lot._id,
    packetId: packet._id,
  });

  const { summary } = buildPacketData(lot, [
    ...otherPackets,
    packet.toObject(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.PACKET.UPDATED,
    data: { packet: toPacketResponse(lot, packet), summary },
  });
});

export const createAssortmentPacket = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  if (lot.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.PACKET.LOT_CLOSED);
  }

  const existingPackets = await AssortmentPacket.find({ lot: lot._id })
    .select('srNo name grade carat')
    .sort({ srNo: 1 })
    .lean();
  await backfillPrimaryPacketData(lot, existingPackets);
  const currentSummary = buildSummary(lot, existingPackets);

  if (currentSummary.totalPackets >= lot.totalPcs) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.PCS_LIMIT);
  }

  const nextTotalMilliCarat =
    toMilliCarat(currentSummary.totalCarat) + toMilliCarat(req.body.carat);
  if (nextTotalMilliCarat > toMilliCarat(lot.totalCarat)) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.CARAT_LIMIT);
  }

  const nextSrNo = existingPackets.length
    ? existingPackets[existingPackets.length - 1].srNo + 1
    : 1;
  const packet = await AssortmentPacket.create({
    lot: lot._id,
    srNo: nextSrNo,
    name: buildPacketName(lot.kapanNo, nextSrNo),
    grade: PRIMARY_GRADE,
    carat: req.body.carat,
    createdBy: req.user?._id,
  });

  await logAudit({
    action: 'ASSORTMENT_PACKET_CREATED',
    entityType: 'AssortmentPacket',
    entityId: packet._id.toString(),
    user: req.user,
    req,
    details: {
      lotId: lot._id.toString(),
      kapanNo: lot.kapanNo,
      srNo: packet.srNo,
      grade: packet.grade,
      carat: packet.carat,
    },
  });
  broadcastEvent('assortment-packet:created', {
    lotId: lot._id,
    packetId: packet._id,
  });

  const { summary } = buildPacketData(lot, [
    ...existingPackets,
    packet.toObject(),
  ]);

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.PACKET.CREATED,
    data: { packet: toPacketResponse(lot, packet), summary },
  });
});
