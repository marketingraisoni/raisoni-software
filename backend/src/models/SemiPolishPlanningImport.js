import mongoose from "mongoose";

const differenceSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    packetNumber: { type: Number, default: null },
    expected: { type: mongoose.Schema.Types.Mixed, default: null },
    actual: { type: mongoose.Schema.Types.Mixed, default: null },
    message: { type: String, required: true },
  },
  { _id: false },
);

const semiPolishPlanningImportSchema = new mongoose.Schema(
  {
    process: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SemiPolishProcess",
      required: true,
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["needs_confirmation", "active", "superseded", "failed"],
      required: true,
      index: true,
    },
    source: { type: String, default: "planning_excel", immutable: true },
    originalFileName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    relativeFilePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    checksumSha256: { type: String, required: true, index: true },
    sheetName: { type: String, default: "FILE" },
    packetCount: { type: Number, required: true },
    plannedPieceCount: { type: Number, required: true },
    planningRoughCarat: { type: Number, required: true },
    plannedPolishedCarat: { type: Number, required: true },
    plannedYieldPercentage: { type: Number, required: true },
    matchedPacketCount: { type: Number, required: true },
    differences: { type: [differenceSchema], default: [] },
    confirmationReason: { type: String, default: "" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

semiPolishPlanningImportSchema.index(
  { process: 1, version: 1 },
  { unique: true },
);
semiPolishPlanningImportSchema.index({ process: 1, status: 1 });

export const SemiPolishPlanningImport = mongoose.model(
  "SemiPolishPlanningImport",
  semiPolishPlanningImportSchema,
);
