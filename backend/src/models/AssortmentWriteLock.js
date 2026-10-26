import mongoose from 'mongoose';

const assortmentWriteLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

// Stale locks are also safe to overwrite during acquisition. The TTL index
// simply keeps abandoned lock documents from accumulating after a crash.
assortmentWriteLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AssortmentWriteLock = mongoose.model(
  'AssortmentWriteLock',
  assortmentWriteLockSchema
);
