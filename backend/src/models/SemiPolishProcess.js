import mongoose from 'mongoose';

const packetSnapshotSchema = new mongoose.Schema(
  {
    packetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssortmentPacket',
      required: true,
    },
    srNo: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      default: 'A',
    },
    carat: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const semiPolishProcessSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lot',
      required: true,
      index: true,
    },
    kapanNo: {
      type: String,
      required: true,
      uppercase: true,
    },
    issueNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['in_process', 'returned', 'cancelled'],
      default: 'in_process',
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expectedReturnDate: {
      type: Date,
      default: null,
    },
    issuedPieces: {
      type: Number,
      required: true,
    },
    issuedCarat: {
      type: Number,
      required: true,
    },
    packets: [packetSnapshotSchema],
    returnedPieces: {
      type: Number,
      default: null,
    },
    returnedCarat: {
      type: Number,
      default: null,
    },
    processLossCarat: {
      type: Number,
      default: null,
    },
    processLossPercentage: {
      type: Number,
      default: null,
    },
    returnDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    returnNotes: {
      type: String,
      default: '',
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

semiPolishProcessSchema.index({ lot: 1, status: 1 });
semiPolishProcessSchema.index({ issueDate: -1 });

export const SemiPolishProcess = mongoose.model('SemiPolishProcess', semiPolishProcessSchema);
