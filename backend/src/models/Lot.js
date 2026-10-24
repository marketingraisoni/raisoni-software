import mongoose from 'mongoose';

const lotSchema = new mongoose.Schema(
  {
    kapanNo: {
      type: String,
      required: [true, 'Kapan No is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Kapan No must contain exactly 2 letters'],
      maxlength: [2, 'Kapan No must contain exactly 2 letters'],
      match: [/^[A-Z]{2}$/, 'Kapan No must contain only letters from A to Z']
    },
    totalCarat: {
      type: Number,
      required: [true, 'Total Carat is required'],
      min: [0.001, 'Total Carat must be greater than 0']
    },
    totalPcs: {
      type: Number,
      required: [true, 'Total Pkt is required'],
      min: [1, 'Total Pkt must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Total Pkt must be a whole number'
      }
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry Date is required'],
      default: Date.now,
      immutable: true
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date,
      default: null,
      select: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.deletedAt;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.deletedAt;
        return ret;
      }
    }
  }
);

// A Kapan No is unique only while its lot is not soft-deleted.
lotSchema.index(
  { kapanNo: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

// Text search index for kapanNo
lotSchema.index({ kapanNo: 'text' });

export const Lot = mongoose.model('Lot', lotSchema);
