import { cacheService } from '../services/cacheService.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ component: 'cache' });

// Upper bound on how long a write response waits for cache invalidation (Redis commands
// already time out on their own; this is a second guard so a response is never stuck).
const INVALIDATION_WAIT_MS = 1500;

const isSuccess = (statusCode) => statusCode >= 200 && statusCode < 300;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Caches successful JSON responses of a GET route.
 *
 * @param {number} ttlSeconds
 * @param {object} [options]
 * @param {string} [options.prefix='route'] Key namespace; invalidate with `${prefix}*` patterns.
 * @param {boolean} [options.userScoped=false] Separate cache per signed-in user. Use whenever the
 *   response depends on who is asking.
 * @param {(req) => string} [options.keyGenerator] Custom key.
 * @param {(req) => boolean} [options.skip] Return true to bypass the cache for a request.
 * @param {(body, req) => any} [options.personalize] Adjusts a shared cached body for the current
 *   request (e.g. a per-client field) before it is sent.
 *
 * Clients can force fresh data with `?nocache=1` or the `X-No-Cache: 1` header.
 */
export function cacheResponse(ttlSeconds = 60, options = {}) {
  const { prefix = 'route', userScoped = false, keyGenerator = null, skip = null, personalize = null } = options;

  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const sendBody = (body) => res.status(200).json(personalize ? personalize(body, req) : body);

    if (req.query?.nocache === '1' || req.headers['x-no-cache'] || (skip && skip(req))) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const userPart = userScoped && req.user?._id ? `user:${req.user._id}:` : '';
    const cacheKey = keyGenerator ? keyGenerator(req) : `${prefix}:${userPart}${req.originalUrl}`;

    let cached = null;
    try {
      cached = await cacheService.get(cacheKey);
    } catch (err) {
      logger.warn(`Cache read failed for "${cacheKey}"; serving fresh data.`, { error: err.message });
    }

    const markCache = (status) => {
      res.setHeader('X-Cache', status);
      if (res.locals) res.locals.cacheStatus = status; // shown in the request log line
    };

    if (cached !== null && cached !== undefined) {
      markCache('HIT');
      return sendBody(cached);
    }

    markCache('MISS');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.json = originalJson; // Only the first json() call is cached.
      if (isSuccess(res.statusCode) && body !== undefined && body?.success !== false) {
        cacheService.set(cacheKey, body, ttlSeconds).catch((err) => {
          logger.warn(`Cache write failed for "${cacheKey}".`, { error: err.message });
        });
        if (personalize) return originalJson(personalize(body, req));
      }
      return originalJson(body);
    };

    return next();
  };
}

/**
 * Clears cache patterns after a successful write, before the response is sent, so the
 * client's next read always sees fresh data.
 *
 * @param {...string} patterns e.g. 'dashboard:*', 'settings:*'
 */
export function invalidateCacheMiddleware(...patterns) {
  return invalidateOnSuccess(() => patterns);
}

/**
 * Same as invalidateCacheMiddleware, but decides the patterns per request.
 * Returning an empty array skips invalidation.
 *
 * @param {(req) => string[]} resolvePatterns
 */
export function invalidateOnSuccess(resolvePatterns) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      res.json = originalJson;
      const patterns = isSuccess(res.statusCode) ? resolvePatterns(req) : [];
      if (!patterns || patterns.length === 0) return originalJson(body);

      const invalidation = Promise.all(
        patterns.map((pattern) =>
          cacheService.delByPattern(pattern).catch((err) => {
            logger.warn(`Cache invalidation failed for "${pattern}".`, { error: err.message });
          })
        )
      );

      withTimeout(invalidation, INVALIDATION_WAIT_MS).finally(() => {
        if (!res.headersSent) originalJson(body);
      });
      return res;
    };

    return next();
  };
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * App-level guard: any successful data change under /api clears the dashboard cache, so new
 * modules never have to remember to do it. Paths in `excludePrefixes` (e.g. login, chat) skip it.
 */
export function invalidateDashboardOnWrite({ excludePrefixes = [] } = {}) {
  return invalidateOnSuccess((req) => {
    if (!MUTATING_METHODS.has(req.method)) return [];
    if (excludePrefixes.some((prefix) => req.originalUrl.startsWith(prefix))) return [];
    return ['dashboard:*'];
  });
}
