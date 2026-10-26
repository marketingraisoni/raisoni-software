import { randomUUID } from 'node:crypto';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { AssortmentWriteLock } from '../models/AssortmentWriteLock.js';

const LOCK_LEASE_MS = 90_000;
const LOCK_WAIT_MS = 45_000;
const RETRY_MIN_MS = 20;
const RETRY_JITTER_MS = 30;
const localQueues = new Map();

export async function withLocalAssortmentWriteQueue(lotId, operation) {
  const key = String(lotId);
  const previous = localQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  localQueues.set(key, current);

  try {
    return await current;
  } finally {
    if (localQueues.get(key) === current) localQueues.delete(key);
  }
}

function waitBeforeRetry() {
  const delay = RETRY_MIN_MS + Math.floor(Math.random() * RETRY_JITTER_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function acquireDatabaseLock(lotId, owner) {
  const lockId = `assortment:${String(lotId)}`;
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    const now = new Date();
    try {
      const lock = await AssortmentWriteLock.findOneAndUpdate(
        {
          _id: lockId,
          $or: [{ expiresAt: { $lte: now } }, { owner }],
        },
        {
          $set: {
            owner,
            expiresAt: new Date(Date.now() + LOCK_LEASE_MS),
          },
        },
        { upsert: true, new: true }
      ).lean();

      if (lock?.owner === owner) return lockId;
    } catch (error) {
      // An upsert races with an existing active lock by design. Its unique _id
      // rejects the insert, after which this request waits and tries again.
      if (error?.code !== 11000) throw error;
    }
    await waitBeforeRetry();
  }

  throw ApiError.conflict(API_MESSAGES.PACKET.CREATE_BUSY);
}

export async function withAssortmentWriteLock(lotId, operation) {
  return withLocalAssortmentWriteQueue(lotId, async () => {
    const owner = randomUUID();
    const lockId = await acquireDatabaseLock(lotId, owner);

    try {
      return await operation();
    } finally {
      await AssortmentWriteLock.deleteOne({ _id: lockId, owner }).catch(
        () => undefined
      );
    }
  });
}
