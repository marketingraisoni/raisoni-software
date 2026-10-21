import mongoose from 'mongoose';

const assortmentGradeSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lot',
      required: true,
      index: true
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
    targetPcs: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Grade pieces must be a whole number'
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

assortmentGradeSchema.index({ lot: 1, grade: 1 }, { unique: true });

export const AssortmentGrade = mongoose.model('AssortmentGrade', assortmentGradeSchema);
