import rateLimit from 'express-rate-limit';
import { getRedisClient, isRedisConnected, scanKeys } from '../config/redis.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ component: 'rate-limit' });
const FAILURE_LOG_THROTTLE_MS = 60_000;

// INCR + set expiry on first hit + read remaining TTL, atomically in one round trip.
// Doing these as separate commands can leave a counter without an expiry if the
// connection drops in between, which would block that user/IP permanently.
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { hits, ttl }
`;

const scriptReadyClients = new WeakSet();

function getScriptedClient() {
  const client = getRedisClient();
  if (!client) return null;
  if (!scriptReadyClients.has(client)) {
    client.defineCommand('rateLimitIncrement', { numberOfKeys: 1, lua: INCREMENT_SCRIPT });
    scriptReadyClients.add(client);
  }
  return client;
}

/**
 * express-rate-limit store: shared counters in Redis when it is online (limits hold across
 * restarts), otherwise per-process memory counters. Never throws, so a store problem can
 * never block traffic.
 */
export class ResilientStore {
  constructor(name) {
    this.name = name;
    this.prefix = `rl:${name}:`;
    this.windowMs = 60_000;
    this.memoryRecords = new Map();
    this.lastFailureLog = 0;

    this.sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.memoryRecords) {
        if (record.resetTime <= now) this.memoryRecords.delete(key);
      }
    }, 60_000);
    this.sweepTimer.unref();
  }

  init(options) {
    this.windowMs = options.windowMs || this.windowMs;
  }

  reportFailure(err) {
    const now = Date.now();
    if (now - this.lastFailureLog < FAILURE_LOG_THROTTLE_MS) return;
    this.lastFailureLog = now;
    logger.warn(`Redis rate-limit store "${this.name}" failed; using memory counters.`, { error: err.message });
  }

  memoryIncrement(key) {
    const now = Date.now();
    let record = this.memoryRecords.get(key);
    if (!record || record.resetTime <= now) {
      record = { totalHits: 0, resetTime: now + this.windowMs };
      this.memoryRecords.set(key, record);
    }
    record.totalHits++;
    return { totalHits: record.totalHits, resetTime: new Date(record.resetTime) };
  }

  async get(key) {
    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        const [hits, ttl] = await Promise.all([client.get(this.prefix + key), client.pttl(this.prefix + key)]);
        if (hits === null) return undefined;
        return { totalHits: Number(hits), resetTime: new Date(Date.now() + Math.max(ttl, 0)) };
      } catch (err) {
        this.reportFailure(err);
      }
    }
    const record = this.memoryRecords.get(key);
    return record ? { totalHits: record.totalHits, resetTime: new Date(record.resetTime) } : undefined;
  }

  async increment(key) {
    if (isRedisConnected()) {
      try {
        const [hits, ttl] = await getScriptedClient().rateLimitIncrement(this.prefix + key, this.windowMs);
        return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttl)) };
      } catch (err) {
        this.reportFailure(err);
      }
    }
    return this.memoryIncrement(key);
  }

  async decrement(key) {
    if (isRedisConnected()) {
      try {
        await getRedisClient().decr(this.prefix + key);
        return;
      } catch (err) {
        this.reportFailure(err);
      }
    }
    const record = this.memoryRecords.get(key);
    if (record && record.totalHits > 0) record.totalHits--;
  }

  async resetKey(key) {
    this.memoryRecords.delete(key);
    if (isRedisConnected()) {
      try {
        await getRedisClient().del(this.prefix + key);
      } catch (err) {
        this.reportFailure(err);
      }
    }
  }

  async resetAll() {
    this.memoryRecords.clear();
    if (isRedisConnected()) {
      try {
        const keys = await scanKeys(`${this.prefix}*`);
        if (keys.length) await getRedisClient().del(...keys);
      } catch (err) {
        this.reportFailure(err);
      }
    }
  }

  shutdown() {
    clearInterval(this.sweepTimer);
  }
}

function limitHandler(name, message) {
  return (req, _res, next, options) => {
    logger.warn(`Rate limit "${name}" exceeded.`, {
      ip: req.ip,
      limit: options.limit,
      windowMs: options.windowMs,
    });
    next(ApiError.tooManyRequests(message));
  };
}

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: new ResilientStore('auth:login'),
  handler: limitHandler('login', API_MESSAGES.AUTH.LOGIN_RATE_LIMITED),
});

export const assortmentWriteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: new ResilientStore('assortment:write'),
  // Authentication runs before the lot router, so this limits each user
  // independently even when many office users share one public IP address.
  keyGenerator: (req) => (req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`),
  handler: limitHandler('assortment-write', API_MESSAGES.PACKET.WRITE_RATE_LIMITED),
});

/**
 * Global safety net mounted on /api before the routers. Authentication has not run
 * yet at that point, so it limits per client IP (each LAN PC has its own address).
 * The ceiling is generous; it only stops runaway loops or a misbehaving client.
 */
export const highFrequencyApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: new ResilientStore('api:general'),
  keyGenerator: (req) => `ip:${req.ip}`,
  handler: limitHandler('api-general', 'Too many requests. Please slow down and try again shortly.'),
});
