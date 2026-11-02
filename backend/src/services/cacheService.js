import { getRedisClient, isRedisConnected, scanKeys } from '../config/redis.js';
import { logger as rootLogger } from '../utils/logger.js';

/**
 * Two-tier cache: Redis when it is online, process memory otherwise.
 *
 * Every write also lands in memory, and every delete clears both tiers, so a Redis
 * outage never serves data that was invalidated while Redis was up. No method throws:
 * a cache problem degrades to a cache miss, never to a failed API request.
 */

const logger = rootLogger.child({ component: 'cache' });

const MAX_MEMORY_ENTRIES = 5000;
const FAILURE_LOG_THROTTLE_MS = 60_000;

const memoryStore = new Map();
const inFlight = new Map();
const lastFailureLog = new Map();

const stats = {
  hits: 0,
  misses: 0,
  writes: 0,
  deletes: 0,
  redisErrors: 0,
  coalescedFetches: 0,
};

const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}, 60_000);
sweepTimer.unref();

/** Logs a Redis failure at most once a minute per operation, so a Redis outage cannot flood the logs. */
function reportRedisFailure(operation, key, err) {
  stats.redisErrors++;
  const now = Date.now();
  if (now - (lastFailureLog.get(operation) || 0) < FAILURE_LOG_THROTTLE_MS) return;
  lastFailureLog.set(operation, now);
  logger.warn(`Redis ${operation} failed; using memory fallback.`, { key, error: err.message });
}

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlSeconds) {
  if (!memoryStore.has(key) && memoryStore.size >= MAX_MEMORY_ENTRIES) {
    // Map keeps insertion order, so the first key is the oldest entry.
    memoryStore.delete(memoryStore.keys().next().value);
  }
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memoryDeleteByPattern(pattern) {
  const regex = patternToRegex(pattern);
  let removed = 0;
  for (const key of memoryStore.keys()) {
    if (regex.test(key)) {
      memoryStore.delete(key);
      removed++;
    }
  }
  return removed;
}

export const cacheService = {
  async get(key) {
    if (!key) return null;

    if (isRedisConnected()) {
      try {
        const raw = await getRedisClient().get(key);
        if (raw !== null) {
          try {
            stats.hits++;
            return JSON.parse(raw);
          } catch {
            // Corrupted / foreign value: drop it and treat as a miss.
            stats.hits--;
            await this.del(key);
          }
        }
        stats.misses++;
        return null;
      } catch (err) {
        reportRedisFailure('GET', key, err);
      }
    }

    const value = memoryGet(key);
    if (value === null) stats.misses++;
    else stats.hits++;
    return value;
  },

  async set(key, value, ttlSeconds = 60) {
    if (!key || value === undefined) return false;
    const ttl = Math.max(1, Math.floor(ttlSeconds));

    memorySet(key, value, ttl);
    stats.writes++;

    if (isRedisConnected()) {
      try {
        await getRedisClient().set(key, JSON.stringify(value), 'EX', ttl);
      } catch (err) {
        reportRedisFailure('SET', key, err);
      }
    }
    return true;
  },

  async del(...keys) {
    const validKeys = keys.flat().filter(Boolean);
    if (validKeys.length === 0) return 0;
    validKeys.forEach((key) => memoryStore.delete(key));
    stats.deletes += validKeys.length;

    if (isRedisConnected()) {
      try {
        await getRedisClient().del(...validKeys);
      } catch (err) {
        reportRedisFailure('DEL', validKeys[0], err);
      }
    }
    return validKeys.length;
  },

  /**
   * Deletes every key matching a glob pattern (e.g. 'dashboard:*') from both tiers.
   * Resolves only after Redis has finished deleting, so a client that re-reads right
   * after a write never gets the stale value.
   */
  async delByPattern(pattern) {
    if (!pattern) return 0;
    const memoryRemoved = memoryDeleteByPattern(pattern);
    if (!isRedisConnected()) return memoryRemoved;

    try {
      const keys = await scanKeys(pattern);
      const client = getRedisClient();
      for (let i = 0; i < keys.length; i += 500) {
        await client.del(...keys.slice(i, i + 500));
      }
      stats.deletes += keys.length;
      if (keys.length > 0) logger.debug(`Invalidated ${keys.length} cache key(s) for "${pattern}".`);
      return Math.max(memoryRemoved, keys.length);
    } catch (err) {
      reportRedisFailure('DELETE-PATTERN', pattern, err);
      return memoryRemoved;
    }
  },

  /**
   * Cache-aside helper. Concurrent callers asking for the same missing key share one
   * fetch, so a burst of identical requests runs the expensive query only once.
   */
  async wrap(key, ttlSeconds, fetcher) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) return cached;

    if (inFlight.has(key)) {
      stats.coalescedFetches++;
      return inFlight.get(key);
    }

    const pending = (async () => {
      try {
        const fresh = await fetcher();
        if (fresh !== undefined && fresh !== null) await this.set(key, fresh, ttlSeconds);
        return fresh;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, pending);
    return pending;
  },

  invalidateDashboard() {
    return this.delByPattern('dashboard:*');
  },

  /** Clears the cached chat lists and unread counters of the given users. */
  async invalidateChatUsers(...userIds) {
    const ids = [...new Set(userIds.flat().filter(Boolean).map(String))];
    await Promise.all(ids.map((id) => this.delByPattern(`chat:*:user:${id}:*`)));
  },

  invalidateAllChats() {
    return this.delByPattern('chat:*');
  },

  invalidateSettings() {
    return this.delByPattern('settings:*');
  },

  /** Removes every key this application owns (only keys under REDIS_KEY_PREFIX). */
  async flush() {
    memoryStore.clear();
    inFlight.clear();
    await this.delByPattern('*');
  },

  getStats() {
    const lookups = stats.hits + stats.misses;
    return {
      mode: isRedisConnected() ? 'redis' : 'memory_fallback',
      isRedisConnected: isRedisConnected(),
      ...stats,
      hitRatePercent: lookups ? Math.round((stats.hits / lookups) * 1000) / 10 : null,
      memoryFallbackEntries: memoryStore.size,
    };
  },
};
