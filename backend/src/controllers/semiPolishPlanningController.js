import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../errors/ApiError.js";
import { SemiPolishProcess } from "../models/SemiPolishProcess.js";
import { SemiPolishPlanningImport } from "../models/SemiPolishPlanningImport.js";
import { SemiPolishPacketPlan } from "../models/SemiPolishPacketPlan.js";
import { SemiPolishPacketReturn } from "../models/SemiPolishPacketReturn.js";
import { logAudit } from "../services/auditService.js";
import {
  extractPacketIdentity,
  parsePlanningWorkbook,
} from "../services/semiPolishPlanningExcelService.js";
import { broadcastEvent } from "../sockets/socketManager.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const planningFilesRoot = path.resolve(
  __dirname,
  "../../../data/planning-files",
);
const CARAT_TOLERANCE = 0.001;

function roundCarat(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function safeFileName(value) {
  const safe = path
    .basename(String(value || "planning.xlsx"))
    .replace(/[^a-z0-9_.-]/gi, "-");
  return safe.toLowerCase().endsWith(".xlsx") ? safe : `${safe}.xlsx`;
}

function packetNumberFromIssuedPacket(packet) {
  return extractPacketIdentity(packet.name).packetNumber ?? Number(packet.srNo);
}

function pieceSignature(pieces) {
  return JSON.stringify(
    pieces.map((piece) => ({
      polishedCarat: roundCarat(piece.polishedCarat),
      shape: piece.shape || "",
      cut: piece.cut || "",
      color: piece.color || "",
      clarity: piece.clarity || "",
      ls: piece.ls || "",
    })),
  );
}

async function findProcess(processId) {
  const process = await SemiPolishProcess.findById(processId);
  if (!process) throw ApiError.notFound("4P Semi-Polish record not found");
  return process;
}

async function activateImport(process, planningImport, user) {
  await SemiPolishPlanningImport.updateMany(
    {
      process: process._id,
      status: "active",
      _id: { $ne: planningImport._id },
    },
    { $set: { status: "superseded" } },
  );
  planningImport.status = "active";
  planningImport.confirmedBy = user?._id;
  planningImport.confirmedAt = new Date();
  await planningImport.save();

  process.activePlanningImport = planningImport._id;
  process.planningImportedAt = planningImport.confirmedAt;
  process.plannedPacketCount = planningImport.packetCount;
  process.plannedPolishedPieces = planningImport.plannedPieceCount;
  process.planningRoughCarat = planningImport.planningRoughCarat;
  process.plannedPolishedCarat = planningImport.plannedPolishedCarat;
  process.plannedYieldPercentage = planningImport.plannedYieldPercentage;
  await process.save();
}

async function buildProgress(process) {
  const returns = await SemiPolishPacketReturn.find({ process: process._id })
    .select("status verifiedPieceCount receivedAt packetNumber")
    .sort({ receivedAt: -1 })
    .lean();
  return {
    expectedPackets: process.packets.length,
    receivedPackets: returns.length,
    verifiedPackets: returns.filter((item) => item.status === "verified")
      .length,
    issuePackets: returns.filter((item) => item.status === "issue").length,
    pendingPackets: Math.max(process.packets.length - returns.length, 0),
    verifiedPieces: returns.reduce(
      (total, item) => total + Number(item.verifiedPieceCount || 0),
      0,
    ),
    plannedPieces: process.plannedPolishedPieces || 0,
    lastReceivedAt: returns[0]?.receivedAt ?? null,
    lastPacketNumber: returns[0]?.packetNumber ?? null,
  };
}

export const importPlanningWorkbook = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  if (process.status !== "in_process") {
    throw ApiError.badRequest(
      "Planning can only be imported for an active 4P process.",
    );
  }
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw ApiError.badRequest("Select a non-empty Excel planning file.");
  }
  if (req.body.length > 20 * 1024 * 1024) {
    throw ApiError.badRequest("Planning files cannot be larger than 20 MB.");
  }

  const originalFileName = safeFileName(req.query.fileName);
  const checksumSha256 = crypto
    .createHash("sha256")
    .update(req.body)
    .digest("hex");
  const duplicate = await SemiPolishPlanningImport.findOne({
    process: process._id,
    checksumSha256,
    status: { $in: ["active", "needs_confirmation"] },
  });
  if (duplicate) {
    throw ApiError.conflict(
      "This planning file has already been imported for this 4P process.",
    );
  }

  let parsed;
  try {
    parsed = parsePlanningWorkbook(req.body);
  } catch (error) {
    throw ApiError.badRequest(
      error.message || "Unable to read the planning workbook.",
    );
  }

  const issuedByNumber = new Map();
  const ambiguousIssuedNumbers = new Set();
  for (const packet of process.packets) {
    const number = packetNumberFromIssuedPacket(packet);
    if (issuedByNumber.has(number)) ambiguousIssuedNumbers.add(number);
    else issuedByNumber.set(number, packet);
  }
  if (ambiguousIssuedNumbers.size) {
    throw ApiError.badRequest(
      `Issued packet numbers are ambiguous: ${[...ambiguousIssuedNumbers].join(", ")}.`,
    );
  }

  const differences = [];
  const plansWithMatches = parsed.packetPlans.map((plan) => {
    const issuedPacket = issuedByNumber.get(plan.packetNumber);
    if (!issuedPacket) {
      differences.push({
        type: "extra_planning_packet",
        packetNumber: plan.packetNumber,
        expected: null,
        actual: plan.rawPacketLabel,
        message: `Planning packet ${plan.packetNumber} is not in the issued packet list.`,
      });
      return { ...plan, issuedPacket: null, matchStatus: "unmatched" };
    }
    const caratDifference = roundCarat(
      plan.roughCarat - Number(issuedPacket.carat),
    );
    const matchStatus =
      Math.abs(caratDifference) <= CARAT_TOLERANCE
        ? "matched"
        : "weight_mismatch";
    if (matchStatus === "weight_mismatch") {
      differences.push({
        type: "rough_carat_mismatch",
        packetNumber: plan.packetNumber,
        expected: issuedPacket.carat,
        actual: plan.roughCarat,
        message: `Packet ${plan.packetNumber} rough carat differs by ${caratDifference.toFixed(3)} CT.`,
      });
    }
    return { ...plan, issuedPacket, matchStatus, caratDifference };
  });

  const planningNumbers = new Set(
    parsed.packetPlans.map((plan) => plan.packetNumber),
  );
  for (const [packetNumber] of issuedByNumber) {
    if (!planningNumbers.has(packetNumber)) {
      differences.push({
        type: "missing_planning_packet",
        packetNumber,
        expected: packetNumber,
        actual: null,
        message: `Issued packet ${packetNumber} is missing from the planning file.`,
      });
    }
  }

  const totalRoughDifference = roundCarat(
    parsed.planningRoughCarat - process.issuedCarat,
  );
  if (Math.abs(totalRoughDifference) > CARAT_TOLERANCE) {
    differences.push({
      type: "total_rough_carat_mismatch",
      packetNumber: null,
      expected: process.issuedCarat,
      actual: parsed.planningRoughCarat,
      message: `Planning rough total differs from issued rough total by ${totalRoughDifference.toFixed(3)} CT.`,
    });
  }

  const existingReturns = await SemiPolishPacketReturn.find({
    process: process._id,
  }).lean();
  const newPlanByNumber = new Map(
    plansWithMatches.map((plan) => [plan.packetNumber, plan]),
  );
  for (const returned of existingReturns) {
    const replacement = newPlanByNumber.get(returned.packetNumber);
    if (
      !replacement ||
      replacement.plannedPieceCount !== returned.plannedPieceCount ||
      pieceSignature(replacement.pieces) !== pieceSignature(returned.pieces)
    ) {
      differences.push({
        type: "returned_packet_plan_changed",
        packetNumber: returned.packetNumber,
        expected: {
          pieceCount: returned.plannedPieceCount,
          polishedCarat: returned.plannedPolishedCarat,
        },
        actual: replacement
          ? {
              pieceCount: replacement.plannedPieceCount,
              polishedCarat: replacement.plannedPolishedCarat,
            }
          : null,
        message: `Packet ${returned.packetNumber} was already returned and its planning has changed. Its historical snapshot will remain unchanged.`,
      });
    }
  }

  const latestImport = await SemiPolishPlanningImport.findOne({
    process: process._id,
  })
    .sort({ version: -1 })
    .select("version")
    .lean();
  const version = Number(latestImport?.version || 0) + 1;
  const importId = new SemiPolishPlanningImport()._id;
  const processDirectory = path.join(planningFilesRoot, String(process._id));
  const storedFileName = `v${version}-${String(importId)}-${originalFileName}`;
  const absoluteFilePath = path.join(processDirectory, storedFileName);
  const relativeFilePath = path.relative(
    path.resolve(__dirname, "../../.."),
    absoluteFilePath,
  );

  await fs.mkdir(processDirectory, { recursive: true });
  await fs.writeFile(absoluteFilePath, req.body);

  const status = differences.length ? "needs_confirmation" : "active";
  let planningImport;
  try {
    planningImport = await SemiPolishPlanningImport.create({
      _id: importId,
      process: process._id,
      version,
      status,
      originalFileName,
      storedFileName,
      relativeFilePath,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSize: req.body.length,
      checksumSha256,
      sheetName: parsed.sheetName,
      packetCount: parsed.packetCount,
      plannedPieceCount: parsed.plannedPieceCount,
      planningRoughCarat: parsed.planningRoughCarat,
      plannedPolishedCarat: parsed.plannedPolishedCarat,
      plannedYieldPercentage: parsed.plannedYieldPercentage,
      matchedPacketCount: plansWithMatches.filter((plan) => plan.issuedPacket)
        .length,
      differences,
      uploadedBy: req.user?._id,
    });

    await SemiPolishPacketPlan.insertMany(
      plansWithMatches.map((plan) => ({
        process: process._id,
        planningImport: planningImport._id,
        matchedPacket: plan.issuedPacket?.packetId ?? null,
        matchStatus: plan.matchStatus,
        packetNumber: plan.packetNumber,
        rawPacketLabel: plan.rawPacketLabel,
        planningGrade: plan.planningGrade,
        planningLotNo: plan.planningLotNo,
        roughCarat: plan.roughCarat,
        issuedRoughCarat: plan.issuedPacket?.carat ?? null,
        roughCaratDifference: plan.issuedPacket ? plan.caratDifference : null,
        checkerId: plan.checkerId,
        sourceSerial: plan.sourceSerial,
        plannedPieceCount: plan.plannedPieceCount,
        plannedPolishedCarat: plan.plannedPolishedCarat,
        yieldPercentage: plan.yieldPercentage,
        sourceStartRow: plan.sourceStartRow,
        pieces: plan.pieces,
      })),
    );

    if (status === "active")
      await activateImport(process, planningImport, req.user);
  } catch (error) {
    await fs.unlink(absoluteFilePath).catch(() => {});
    if (planningImport?._id) {
      await SemiPolishPacketPlan.deleteMany({
        planningImport: planningImport._id,
      }).catch(() => {});
      await SemiPolishPlanningImport.deleteOne({
        _id: planningImport._id,
      }).catch(() => {});
    }
    throw error;
  }

  await logAudit({
    action:
      status === "active"
        ? "4P_PLANNING_IMPORTED"
        : "4P_PLANNING_REVIEW_REQUIRED",
    entityType: "SemiPolishPlanningImport",
    entityId: planningImport._id.toString(),
    user: req.user,
    req,
    details: {
      processId: process._id.toString(),
      issueNo: process.issueNo,
      version,
      packetCount: parsed.packetCount,
      plannedPieceCount: parsed.plannedPieceCount,
      differenceCount: differences.length,
    },
  });

  broadcastEvent("semi-polish:planning-imported", {
    processId: process._id,
    planningImportId: planningImport._id,
    status,
  });

  return sendSuccess(res, {
    message: differences.length
      ? "Planning file was parsed. Review and confirm the listed differences."
      : "Planning file imported successfully.",
    data: {
      planningImport,
      differences,
      requiresConfirmation: differences.length > 0,
    },
  });
});

export const confirmPlanningImport = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  if (process.status !== "in_process") {
    throw ApiError.badRequest(
      "Planning can only be confirmed for an active 4P process.",
    );
  }
  const planningImport = await SemiPolishPlanningImport.findOne({
    _id: req.params.importId,
    process: process._id,
  });
  if (!planningImport) throw ApiError.notFound("Planning import not found");
  if (planningImport.status !== "needs_confirmation") {
    throw ApiError.badRequest(
      `This planning import is already ${planningImport.status}.`,
    );
  }
  const reason = String(req.body.reason || "").trim();
  if (!reason)
    throw ApiError.badRequest(
      "A confirmation reason is required for planning differences.",
    );

  planningImport.confirmationReason = reason;
  await activateImport(process, planningImport, req.user);

  await logAudit({
    action: "4P_PLANNING_DIFFERENCES_CONFIRMED",
    entityType: "SemiPolishPlanningImport",
    entityId: planningImport._id.toString(),
    user: req.user,
    req,
    details: {
      processId: process._id.toString(),
      reason,
      differences: planningImport.differences,
    },
  });

  broadcastEvent("semi-polish:planning-confirmed", {
    processId: process._id,
    planningImportId: planningImport._id,
  });

  return sendSuccess(res, {
    message:
      "Planning differences confirmed and the planning import is now active.",
    data: { planningImport },
  });
});

export const getPlanningDetails = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  const pendingPlanningImport = await SemiPolishPlanningImport.findOne({
    process: process._id,
    status: "needs_confirmation",
  })
    .sort({ version: -1 })
    .populate("uploadedBy", "name username")
    .lean();
  if (!process.activePlanningImport) {
    return sendSuccess(res, {
      message: "No active planning file has been imported.",
      data: {
        planningImport: null,
        pendingPlanningImport,
        packetPlans: [],
        packetReturns: [],
        progress: await buildProgress(process),
      },
    });
  }

  const [planningImport, packetPlans, packetReturns, progress] =
    await Promise.all([
      SemiPolishPlanningImport.findById(process.activePlanningImport)
        .populate("uploadedBy", "name username")
        .populate("confirmedBy", "name username")
        .lean(),
      SemiPolishPacketPlan.find({
        planningImport: process.activePlanningImport,
      })
        .sort({ packetNumber: 1 })
        .lean(),
      SemiPolishPacketReturn.find({ process: process._id })
        .populate("receivedBy", "name username")
        .populate("issue.resolvedBy", "name username")
        .sort({ receivedAt: -1 })
        .lean(),
      buildProgress(process),
    ]);

  return sendSuccess(res, {
    message: "4P planning and packet returns retrieved successfully.",
    data: {
      planningImport,
      pendingPlanningImport,
      packetPlans,
      packetReturns,
      progress,
    },
  });
});

export const downloadPlanningWorkbook = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  if (!process.activePlanningImport)
    throw ApiError.notFound("No active planning file is available.");
  const planningImport = await SemiPolishPlanningImport.findById(
    process.activePlanningImport,
  ).lean();
  if (!planningImport) throw ApiError.notFound("Planning import not found");

  const projectRoot = path.resolve(__dirname, "../../..");
  const absoluteFilePath = path.resolve(
    projectRoot,
    planningImport.relativeFilePath,
  );
  if (!absoluteFilePath.startsWith(`${planningFilesRoot}${path.sep}`)) {
    throw ApiError.badRequest("Stored planning file path is invalid.");
  }
  await fs.access(absoluteFilePath).catch(() => {
    throw ApiError.notFound("The stored planning file is unavailable.");
  });
  res.download(absoluteFilePath, planningImport.originalFileName);
});

export const receivePlannedPacket = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  if (process.status !== "in_process") {
    throw ApiError.badRequest(
      "Packets can only be received for an active 4P process.",
    );
  }
  if (!process.activePlanningImport) {
    throw ApiError.badRequest(
      "Import a planning file before receiving packets.",
    );
  }
  const packetNumber = Number(req.params.packetNumber);
  if (!Number.isInteger(packetNumber) || packetNumber < 1) {
    throw ApiError.badRequest("Enter a valid packet number.");
  }

  const existing = await SemiPolishPacketReturn.findOne({
    process: process._id,
    packetNumber,
  });
  if (existing) {
    throw ApiError.conflict(`Packet ${packetNumber} was already received.`, {
      packetReturnId: existing._id,
      receivedAt: existing.receivedAt,
    });
  }

  const packetPlan = await SemiPolishPacketPlan.findOne({
    planningImport: process.activePlanningImport,
    packetNumber,
  });
  if (!packetPlan)
    throw ApiError.notFound(
      `Packet ${packetNumber} is not in the active planning file.`,
    );
  if (!packetPlan.matchedPacket) {
    throw ApiError.badRequest(
      `Packet ${packetNumber} is not matched to an issued packet.`,
    );
  }

  const hasDifference = Boolean(req.body.hasDifference);
  const issueDetails = String(req.body.issueDetails || "").trim();
  const issueType = String(req.body.issueType || "").trim();
  const observedPieceCount =
    req.body.observedPieceCount === undefined
      ? packetPlan.plannedPieceCount
      : Number(req.body.observedPieceCount);
  if (!Number.isInteger(observedPieceCount) || observedPieceCount < 0) {
    throw ApiError.badRequest(
      "Observed piece count must be a whole number of zero or more.",
    );
  }
  if (hasDifference && (!issueType || !issueDetails)) {
    throw ApiError.badRequest(
      "Issue type and details are required when reporting a difference.",
    );
  }

  const packetReturn = await SemiPolishPacketReturn.create({
    process: process._id,
    planningImport: packetPlan.planningImport,
    packetPlan: packetPlan._id,
    packet: packetPlan.matchedPacket,
    packetNumber,
    status: hasDifference ? "issue" : "verified",
    source: req.body.source === "barcode" ? "barcode" : "manual",
    plannedPieceCount: packetPlan.plannedPieceCount,
    verifiedPieceCount: observedPieceCount,
    plannedPolishedCarat: packetPlan.plannedPolishedCarat,
    pieces: packetPlan.pieces.map((piece) => ({
      planningPieceId: piece._id,
      pieceNumber: piece.pieceNumber,
      sourceRow: piece.sourceRow,
      polishedCarat: piece.polishedCarat,
      shape: piece.shape,
      cut: piece.cut,
      color: piece.color,
      clarity: piece.clarity,
      ls: piece.ls,
    })),
    issue: hasDifference
      ? {
          reported: true,
          type: issueType,
          details: issueDetails,
          observedPieceCount,
        }
      : { reported: false, resolved: true },
    notes: String(req.body.notes || "").trim(),
    receivedAt: new Date(),
    receivedBy: req.user?._id,
  });

  const progress = await buildProgress(process);
  process.returnedPacketCount = progress.receivedPackets;
  process.returnedPolishedPieceCount = progress.verifiedPieces;
  await process.save();

  await logAudit({
    action: hasDifference ? "4P_PACKET_RETURN_ISSUE" : "4P_PACKET_RECEIVED",
    entityType: "SemiPolishPacketReturn",
    entityId: packetReturn._id.toString(),
    user: req.user,
    req,
    details: {
      processId: process._id.toString(),
      issueNo: process.issueNo,
      packetNumber,
      plannedPieceCount: packetPlan.plannedPieceCount,
      observedPieceCount,
      hasDifference,
    },
  });

  broadcastEvent("semi-polish:packet-received", {
    processId: process._id,
    packetNumber,
    status: packetReturn.status,
  });

  return sendSuccess(res, {
    message: hasDifference
      ? `Packet ${packetNumber} recorded with an issue requiring resolution.`
      : `Packet ${packetNumber} and ${packetPlan.plannedPieceCount} pieces verified.`,
    data: { packetReturn, progress },
  });
});

export const resolvePacketIssue = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  if (process.status !== "in_process") {
    throw ApiError.badRequest(
      "Return issues can only be resolved before finalization.",
    );
  }
  const packetNumber = Number(req.params.packetNumber);
  const packetReturn = await SemiPolishPacketReturn.findOne({
    process: process._id,
    packetNumber,
  });
  if (!packetReturn)
    throw ApiError.notFound(
      `No return record exists for packet ${packetNumber}.`,
    );
  if (packetReturn.status !== "issue") {
    throw ApiError.badRequest(
      `Packet ${packetNumber} does not have an unresolved issue.`,
    );
  }
  const resolutionNote = String(req.body.resolutionNote || "").trim();
  if (!resolutionNote)
    throw ApiError.badRequest("A resolution note is required.");
  const verifiedPieceCount =
    req.body.verifiedPieceCount === undefined
      ? packetReturn.plannedPieceCount
      : Number(req.body.verifiedPieceCount);
  if (!Number.isInteger(verifiedPieceCount) || verifiedPieceCount < 0) {
    throw ApiError.badRequest(
      "Verified piece count must be a whole number of zero or more.",
    );
  }

  packetReturn.status = "verified";
  packetReturn.verifiedPieceCount = verifiedPieceCount;
  packetReturn.issue.resolved = true;
  packetReturn.issue.resolutionNote = resolutionNote;
  packetReturn.issue.resolvedAt = new Date();
  packetReturn.issue.resolvedBy = req.user?._id;
  await packetReturn.save();

  const progress = await buildProgress(process);
  process.returnedPolishedPieceCount = progress.verifiedPieces;
  await process.save();

  await logAudit({
    action: "4P_PACKET_RETURN_ISSUE_RESOLVED",
    entityType: "SemiPolishPacketReturn",
    entityId: packetReturn._id.toString(),
    user: req.user,
    req,
    details: {
      processId: process._id.toString(),
      packetNumber,
      verifiedPieceCount,
      resolutionNote,
    },
  });

  broadcastEvent("semi-polish:packet-issue-resolved", {
    processId: process._id,
    packetNumber,
  });
  return sendSuccess(res, {
    message: `Packet ${packetNumber} issue resolved.`,
    data: { packetReturn, progress },
  });
});

export const finalizePlanningReturn = asyncHandler(async (req, res) => {
  const process = await findProcess(req.params.id);
  if (process.status !== "in_process") {
    throw ApiError.badRequest(`This process is already ${process.status}.`);
  }
  if (!process.activePlanningImport) {
    throw ApiError.badRequest(
      "Import a planning file before finalizing the return.",
    );
  }

  const packetReturns = await SemiPolishPacketReturn.find({
    process: process._id,
  }).lean();
  const unresolved = packetReturns.filter((item) => item.status !== "verified");
  if (unresolved.length) {
    throw ApiError.badRequest(
      `${unresolved.length} packet issue(s) must be resolved first.`,
    );
  }
  if (packetReturns.length !== process.packets.length) {
    throw ApiError.badRequest(
      `Receive all packets before finalizing (${packetReturns.length}/${process.packets.length}).`,
    );
  }

  const returnedPolishedPieceCount = packetReturns.reduce(
    (total, item) => total + Number(item.verifiedPieceCount || 0),
    0,
  );
  const returnedCarat = roundCarat(
    packetReturns.reduce(
      (total, item) => total + Number(item.plannedPolishedCarat || 0),
      0,
    ),
  );
  const processLossCarat = roundCarat(process.issuedCarat - returnedCarat);
  const processLossPercentage =
    process.issuedCarat > 0
      ? Math.round((processLossCarat / process.issuedCarat) * 10_000) / 100
      : 0;

  process.status = "returned";
  process.returnedPacketCount = packetReturns.length;
  process.returnedPolishedPieceCount = returnedPolishedPieceCount;
  process.returnedPieces = returnedPolishedPieceCount;
  process.returnedCarat = returnedCarat;
  process.processLossCarat = processLossCarat;
  process.processLossPercentage = processLossPercentage;
  process.returnDate = new Date();
  process.finalizedAt = process.returnDate;
  process.returnNotes = String(req.body.returnNotes || "").trim();
  process.receivedBy = req.user?._id;
  await process.save();

  await logAudit({
    action: "4P_RETURN_FINALIZED",
    entityType: "SemiPolishProcess",
    entityId: process._id.toString(),
    user: req.user,
    req,
    details: {
      issueNo: process.issueNo,
      returnedPacketCount: packetReturns.length,
      returnedPolishedPieceCount,
      returnedCarat,
      processLossCarat,
      processLossPercentage,
    },
  });

  broadcastEvent("semi-polish:returned", { processId: process._id });
  return sendSuccess(res, {
    message: `4P return ${process.issueNo} finalized successfully.`,
    data: { process },
  });
});
