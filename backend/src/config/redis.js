import Redis from 'ioredis';
import { config } from './env.js';
import { logger as rootLogger } from '../utils/logger.js';

/**
 * Redis connection manager.
 *
 * Redis is an accelerator, never a dependency: the server boots, serves and shuts down
 * normally when Redis is missing, stopped, or flapping. Callers check isRedisConnected()
 * and fall back to in-process memory (see cacheService / rateLimitMiddleware).
 */

const logger = rootLogger.child({ component: 'redis' });
const ERROR_LOG_THROTTLE_MS = 60_000;
const MAX_RETRY_DELAY_MS = 10_000;

let redisClient = null;
let lastErrorLogTime = 0;
let wasEverReady = false;
let isShuttingDown = false;
let downSince = null;

const target = () => `${config.redisHost}:${config.redisPort}/${config.redisDb}`;

function logConnectionError(err) {
  const now = Date.now();
  if (now - lastErrorLogTime < ERROR_LOG_THROTTLE_MS) return;
  lastErrorLogTime = now;
  logger.warn(`Redis unavailable at ${target()} (${err.code || err.message}). Using in-memory fallback.`);
}

/**
 * Creates the singleton client and makes one connection attempt. Never throws.
 * If the first attempt fails, ioredis keeps retrying in the background with backoff,
 * and the backend switches to Redis automatically once it becomes reachable.
 */
export async function initRedis() {
  if (!config.redisEnabled) {
    logger.info('Redis disabled (REDIS_ENABLED=false). Using in-memory cache and rate limiting.');
    return null;
  }
  if (redisClient) return redisClient;

  isShuttingDown = false;
  let initialAttemptDone = false;
  try {
    redisClient = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword || undefined,
      db: config.redisDb,
      keyPrefix: config.redisKeyPrefix,
      lazyConnect: true,
      connectTimeout: config.redisConnectTimeoutMs,
      commandTimeout: config.redisCommandTimeoutMs,
      keepAlive: 30_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Fail fast while offline so callers use the memory fallback at once.
      retryStrategy(times) {
        if (isShuttingDown) return null;
        return Math.min(times * 500, MAX_RETRY_DELAY_MS);
      },
      reconnectOnError(err) {
        // Reconnect when a replica/failover makes the server read-only.
        return err.message.includes('READONLY');
      },
    });

    redisClient.on('ready', () => {
      const outage = downSince ? ` after ${Math.round((Date.now() - downSince) / 1000)}s offline` : '';
      downSince = null;
      lastErrorLogTime = 0;
      if (wasEverReady) {
        logger.success(`Redis reconnected to ${target()}${outage}. Cache and rate limits are shared again.`);
      } else {
        logger.success(`Redis connected to ${target()} (key prefix "${config.redisKeyPrefix}").`);
      }
      wasEverReady = true;
    });

    redisClient.on('error', (err) => {
      if (!downSince) downSince = Date.now();
      // The first failed attempt is reported once by the connect() catch below.
      if (initialAttemptDone) logConnectionError(err);
    });

    redisClient.on('close', () => {
      if (isShuttingDown) return;
      if (!downSince) {
        downSince = Date.now();
        if (wasEverReady) logger.warn('Redis connection lost. Using in-memory fallback until it reconnects.');
      }
    });

    try {
      await redisClient.connect();
    } catch (err) {
      downSince = downSince || Date.now();
      lastErrorLogTime = Date.now();
      logger.warn(
        `Redis is not reachable at ${target()} (${err.code || err.message}). ` +
        'The backend runs normally with the in-memory fallback and will switch to Redis when it comes online.'
      );
    } finally {
      initialAttemptDone = true;
    }

    return redisClient;
  } catch (err) {
    logger.error('Redis client could not be created; continuing without Redis.', { error: err });
    redisClient = null;
    return null;
  }
}

/** True only when commands can be sent right now. */
export function isRedisConnected() {
  return Boolean(redisClient && redisClient.status === 'ready');
}

export function getRedisClient() {
  return redisClient;
}

/** Test-only hook: swap in a fake client (pass null to reset). Not used by application code. */
export function setRedisClientForTesting(client) {
  redisClient = client;
}

/**
 * Returns every key (without the configured prefix) that matches a glob pattern.
 * ioredis does NOT apply keyPrefix to SCAN patterns or to the keys SCAN returns,
 * so both are handled here.
 */
export async function scanKeys(pattern, { count = 200 } = {}) {
  if (!isRedisConnected()) return [];
  const prefix = redisClient.options.keyPrefix || '';
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redisClient.scan(cursor, 'MATCH', `${prefix}${pattern}`, 'COUNT', count);
    cursor = nextCursor;
    for (const key of batch) keys.push(prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key);
  } while (cursor !== '0');
  return keys;
}

export async function disconnectRedis() {
  if (!redisClient) return;
  isShuttingDown = true;
  const client = redisClient;
  redisClient = null;
  try {
    if (client.status === 'ready') await client.quit();
    else client.disconnect();
    logger.info('Redis disconnected.');
  } catch (err) {
    client.disconnect();
    logger.warn(`Redis disconnect error: ${err.message}`);
  } finally {
    wasEverReady = false;
    downSince = null;
  }
}

/** Diagnostics for /api/health and `npm run redis:status`. Never throws. */
export async function getRedisHealth() {
  const base = { host: config.redisHost, port: config.redisPort, db: config.redisDb };

  if (!config.redisEnabled) {
    return { ...base, status: 'disabled', connected: false, mode: 'memory_fallback', message: 'Redis disabled via REDIS_ENABLED=false' };
  }
  if (!isRedisConnected()) {
    return {
      ...base,
      status: 'offline',
      connected: false,
      mode: 'memory_fallback',
      offlineForSeconds: downSince ? Math.round((Date.now() - downSince) / 1000) : null,
      message: 'Redis offline; in-memory fallback is serving requests',
    };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const pingMs = Date.now() - start;
    const info = await redisClient.info().catch(() => '');
    const read = (field) => info.match(new RegExp(`${field}:([^\\r\\n]+)`))?.[1] || 'unknown';

    return {
      ...base,
      status: 'ready',
      connected: true,
      mode: 'redis',
      pingMs,
      version: read('redis_version'),
      usedMemory: read('used_memory_human'),
      uptimeSeconds: Number(read('uptime_in_seconds')) || null,
    };
  } catch (err) {
    return { ...base, status: 'error', connected: false, mode: 'memory_fallback', error: err.message };
  }
}
