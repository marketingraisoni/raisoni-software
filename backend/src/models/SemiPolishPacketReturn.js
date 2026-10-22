import mongoose from "mongoose";

const returnedPieceSnapshotSchema = new mongoose.Schema(
  {
    planningPieceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    pieceNumber: { type: Number, required: true },
    sourceRow: { type: Number, required: true },
    polishedCarat: { type: Number, required: true },
    shape: { type: String, default: "" },
    cut: { type: String, default: "" },
    color: { type: String, default: "" },
    clarity: { type: String, default: "" },
    ls: { type: String, default: "" },
  },
  { _id: false },
);

const issueSchema = new mongoose.Schema(
  {
    reported: { type: Boolean, default: false },
    type: { type: String, default: "" },
    details: { type: String, default: "" },
    observedPieceCount: { type: Number, default: null },
    resolved: { type: Boolean, default: false },
    resolutionNote: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

const semiPolishPacketReturnSchema = new mongoose.Schema(
  {
    process: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SemiPolishProcess",
      required: true,
      index: true,
    },
    planningImport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SemiPolishPlanningImport",
      required: true,
    },
    packetPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SemiPolishPacketPlan",
      required: true,
    },
    packet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssortmentPacket",
      required: true,
    },
    packetNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["verified", "issue"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "barcode"],
      default: "manual",
    },
    plannedPieceCount: { type: Number, required: true },
    verifiedPieceCount: { type: Number, required: true },
    plannedPolishedCarat: { type: Number, required: true },
    pieces: { type: [returnedPieceSnapshotSchema], default: [] },
    issue: { type: issueSchema, default: () => ({}) },
    notes: { type: String, default: "" },
    receivedAt: { type: Date, default: Date.now, required: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

semiPolishPacketReturnSchema.index({ process: 1, packet: 1 }, { unique: true });
semiPolishPacketReturnSchema.index(
  { process: 1, packetNumber: 1 },
  { unique: true },
);
semiPolishPacketReturnSchema.index({ process: 1, receivedAt: -1 });

export const SemiPolishPacketReturn = mongoose.model(
  "SemiPolishPacketReturn",
  semiPolishPacketReturnSchema,
);
