import mongoose from "mongoose";

const plannedPieceSchema = new mongoose.Schema(
  {
    pieceNumber: { type: Number, required: true },
    sourceRow: { type: Number, required: true },
    planningSerial: { type: Number, default: null },
    polishedCarat: { type: Number, required: true },
    shape: { type: String, default: "" },
    cut: { type: String, default: "" },
    color: { type: String, default: "" },
    clarity: { type: String, default: "" },
    ls: { type: String, default: "" },
  },
  { _id: true },
);

const semiPolishPacketPlanSchema = new mongoose.Schema(
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
      index: true,
    },
    source: { type: String, default: "planning_excel", immutable: true },
    matchedPacket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssortmentPacket",
      default: null,
    },
    matchStatus: {
      type: String,
      enum: ["matched", "weight_mismatch", "unmatched"],
      required: true,
    },
    packetNumber: { type: Number, required: true, min: 1 },
    rawPacketLabel: { type: String, required: true },
    planningGrade: { type: String, default: "" },
    planningLotNo: { type: String, default: "" },
    roughCarat: { type: Number, required: true },
    issuedRoughCarat: { type: Number, default: null },
    roughCaratDifference: { type: Number, default: null },
    checkerId: { type: String, default: "" },
    sourceSerial: { type: Number, default: null },
    plannedPieceCount: { type: Number, required: true },
    plannedPolishedCarat: { type: Number, required: true },
    yieldPercentage: { type: Number, required: true },
    sourceStartRow: { type: Number, required: true },
    pieces: { type: [plannedPieceSchema], default: [] },
  },
  { timestamps: true },
);

semiPolishPacketPlanSchema.index(
  { planningImport: 1, packetNumber: 1 },
  { unique: true },
);
semiPolishPacketPlanSchema.index({ process: 1, packetNumber: 1 });

export const SemiPolishPacketPlan = mongoose.model(
  "SemiPolishPacketPlan",
  semiPolishPacketPlanSchema,
);
