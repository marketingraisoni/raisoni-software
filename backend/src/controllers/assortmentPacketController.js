import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { AssortmentPacket } from '../models/AssortmentPacket.js';
import { AssortmentGrade } from '../models/AssortmentGrade.js';
import { Lot } from '../models/Lot.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const toMilliCarat = (value) => Math.round(Number(value) * 1000);
const fromMilliCarat = (value) => value / 1000;

function buildSummary(lot, packets, gradePlans = []) {
  const gradeCounts = new Map();
  let totalMilliCarat = 0;

  for (const packet of packets) {
    gradeCounts.set(packet.grade, (gradeCounts.get(packet.grade) || 0) + 1);
    totalMilliCarat += toMilliCarat(packet.carat);
  }

  const targetMilliCarat = toMilliCarat(lot.totalCarat);
  const totalPackets = packets.length;
  const plannedPackets = gradePlans.reduce((total, plan) => total + plan.targetPcs, 0);

  return {
    gradeCounts: [...gradeCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([grade, count]) => ({ grade, count })),
    grades: gradePlans
      .map((plan) => {
        const createdPackets = gradeCounts.get(plan.grade) || 0;
        return {
          id: String(plan._id),
          grade: plan.grade,
          targetPcs: plan.targetPcs,
          createdPackets,
          remainingPackets: Math.max(plan.targetPcs - createdPackets, 0),
          complete: createdPackets === plan.targetPcs,
        };
      })
      .sort((left, right) => left.grade.localeCompare(right.grade)),
    plannedPackets,
    unplannedPackets: Math.max(lot.totalPcs - plannedPackets, 0),
    totalPackets,
    totalCarat: fromMilliCarat(totalMilliCarat),
    targetPackets: lot.totalPcs,
    targetCarat: lot.totalCarat,
    remainingPackets: Math.max(lot.totalPcs - totalPackets, 0),
    remainingCarat: fromMilliCarat(Math.max(targetMilliCarat - totalMilliCarat, 0)),
    complete: totalPackets === lot.totalPcs && totalMilliCarat === targetMilliCarat,
  };
}

async function findActiveLot(lotId) {
  const lot = await Lot.findOne({ _id: lotId, deletedAt: null });
  if (!lot) throw ApiError.notFound(API_MESSAGES.LOT.NOT_FOUND);
  return lot;
}

export const getAssortmentPackets = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  const [packets, gradePlans] = await Promise.all([
    AssortmentPacket.find({ lot: lot._id }).sort({ srNo: 1 }).lean(),
    AssortmentGrade.find({ lot: lot._id }).sort({ grade: 1 }).lean(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.PACKET.LIST_SUCCESS,
    data: { packets, summary: buildSummary(lot, packets, gradePlans) },
  });
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
  }).select('carat').lean();
  const otherMilliCarat = otherPackets.reduce(
    (total, currentPacket) => total + toMilliCarat(currentPacket.carat),
    0
  );
  if (otherMilliCarat + toMilliCarat(req.body.carat) > toMilliCarat(lot.totalCarat)) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.CARAT_LIMIT);
  }

  const previousCarat = packet.carat;
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

  return sendSuccess(res, {
    message: API_MESSAGES.PACKET.UPDATED,
    data: { packet },
  });
});

export const createAssortmentPacket = asyncHandler(async (req, res) => {
  const lot = await findActiveLot(req.params.lotId);
  if (lot.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.PACKET.LOT_CLOSED);
  }

  const existingPackets = await AssortmentPacket.find({ lot: lot._id })
    .sort({ srNo: 1 })
    .lean();
  const currentSummary = buildSummary(lot, existingPackets);
  const gradePlan = await AssortmentGrade.findOne({
    lot: lot._id,
    grade: req.body.grade,
  });

  if (!gradePlan) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.GRADE_REQUIRED);
  }

  const gradePacketCount = existingPackets.filter(
    (packet) => packet.grade === req.body.grade
  ).length;
  if (gradePacketCount >= gradePlan.targetPcs) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.GRADE_COMPLETE);
  }

  if (currentSummary.totalPackets >= lot.totalPcs) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.PCS_LIMIT);
  }

  const nextTotalMilliCarat =
    toMilliCarat(currentSummary.totalCarat) + toMilliCarat(req.body.carat);
  if (nextTotalMilliCarat > toMilliCarat(lot.totalCarat)) {
    throw ApiError.badRequest(API_MESSAGES.PACKET.CARAT_LIMIT);
  }

  const packet = await AssortmentPacket.create({
    lot: lot._id,
    srNo: existingPackets.length
      ? existingPackets[existingPackets.length - 1].srNo + 1
      : 1,
    grade: req.body.grade,
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

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.PACKET.CREATED,
    data: { packet },
  });
});
