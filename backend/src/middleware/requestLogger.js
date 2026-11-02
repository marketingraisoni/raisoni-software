import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { runWithRequestContext, trackRequestEnd, trackRequestStart } from '../utils/requestContext.js';

const INCOMING_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const SENSITIVE_QUERY_PARAM = /([?&](?:token|access_token|password|secret)=)[^&]*/gi;

function isQuietPath(url) {
  // Health probes and static frontend files are only logged when they fail.
  return url.startsWith('/api/health') || !(url.startsWith('/api') || url.startsWith('/uploads'));
}

function safeUrl(url) {
  return url.replace(SENSITIVE_QUERY_PARAM, '$1[REDACTED]');
}

/**
 * Gives every request an id (returned in the X-Request-Id header and in error responses),
 * runs the request inside a logging context so every log line carries it, and writes one
 * summary line when the request completes, fails or is aborted.
 */
export function requestLogger(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && INCOMING_ID_PATTERN.test(incomingId)
    ? incomingId
    : randomUUID().replace(/-/g, '').slice(0, 12);

  const url = safeUrl(req.originalUrl);
  const ip = req.ip || req.socket?.remoteAddress;
  const startedAt = Date.now();
  const startedHr = process.hrtime.bigint();
  const quiet = isQuietPath(req.originalUrl);

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  let completed = false;
  const complete = (aborted) => {
    if (completed) return;
    completed = true;

    const durationMs = Math.round(Number(process.hrtime.bigint() - startedHr) / 1e5) / 10;
    const status = aborted ? 499 : res.statusCode;
    const userId = req.user?._id ? String(req.user._id) : undefined;
    trackRequestEnd(requestId, { status, durationMs, userId, aborted: aborted || undefined });

    const isSlow = durationMs >= config.slowRequestMs;
    if (quiet && status < 400 && !isSlow) return;

    const meta = {
      status,
      durationMs,
      ip,
      ...(userId ? { userId } : {}),
      ...(res.locals.cacheStatus ? { cache: res.locals.cacheStatus } : {}),
      ...(res.getHeader('content-length') ? { bytes: Number(res.getHeader('content-length')) } : {}),
    };
    const summary = `${req.method} ${url} ${status} ${durationMs}ms`;

    if (aborted) logger.warn(`${summary} - client closed the connection before the response was sent`, meta);
    else if (status >= 500) logger.error(summary, meta);
    else if (status >= 400) logger.warn(summary, meta);
    else if (isSlow) logger.warn(`${summary} - slow request (>= ${config.slowRequestMs}ms)`, meta);
    else logger.http(summary, meta);
  };

  res.on('finish', () => complete(false));
  res.on('close', () => complete(!res.writableFinished));

  const context = { requestId, method: req.method, url, req };
  runWithRequestContext(context, () => {
    trackRequestStart({ requestId, method: req.method, url, ip, startedAt });
    if (!quiet) logger.debug(`--> ${req.method} ${url}`, { ip });
    next();
  });
}
