import mongoose from 'mongoose';

const assortmentPacketSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lot',
      required: true,
      index: true
    },
    srNo: {
      type: Number,
      required: true,
      min: 1
    },
    grade: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 1,
      match: [/^[A-Z]$/, 'Grade must be one letter from A to Z']
    },
    carat: {
      type: Number,
      required: true,
      min: [0.001, 'Packet carat must be greater than 0']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

assortmentPacketSchema.index({ lot: 1, srNo: 1 }, { unique: true });

export const AssortmentPacket = mongoose.model('AssortmentPacket', assortmentPacketSchema);
