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

const receivedDiamondSchema = new mongoose.Schema(
  {
    planningPieceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    pieceNumber: { type: Number, required: true },
    hphtCarat: { type: Number, default: null, min: 0 },
    fourPCarat: { type: Number, default: null, min: 0 },
    shape: { type: String, default: "", trim: true },
    receivedDate: { type: Date, default: Date.now, required: true },
    barcode: { type: String, default: "", trim: true, uppercase: true },
    receivedAt: { type: Date, default: Date.now, required: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true },
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

const packetReceiptSchema = new mongoose.Schema(
  {
    pieceNumbers: { type: [Number], default: [] },
    pieceCount: { type: Number, required: true, min: 0 },
    source: {
      type: String,
      enum: ["manual", "barcode"],
      default: "manual",
    },
    notes: { type: String, default: "" },
    receivedAt: { type: Date, default: Date.now, required: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true },
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
      enum: ["partial", "verified", "issue"],
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
    receivedPieceNumbers: { type: [Number], default: [] },
    plannedPolishedCarat: { type: Number, required: true },
    pieces: { type: [returnedPieceSnapshotSchema], default: [] },
    receivedPieces: { type: [receivedDiamondSchema], default: [] },
    receipts: { type: [packetReceiptSchema], default: [] },
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
semiPolishPacketReturnSchema.index({ process: 1, "receivedPieces.barcode": 1 });

export const SemiPolishPacketReturn = mongoose.model(
  "SemiPolishPacketReturn",
  semiPolishPacketReturnSchema,
);
