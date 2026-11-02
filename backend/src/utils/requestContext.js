import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context shared by every log line written while a request is
 * being processed (requestId, user, route), plus a short history of recent
 * and in-flight requests so a crash report can show exactly which call was
 * running when the process broke.
 */
const storage = new AsyncLocalStorage();

const MAX_RECENT_REQUESTS = 50;
const recentRequests = [];
const activeRequests = new Map();

export function runWithRequestContext(context, callback) {
  return storage.run(context, callback);
}

export function getRequestContext() {
  return storage.getStore() || null;
}

/**
 * Fields added to every log line written inside a request. `req.user` is read
 * lazily because authentication runs after the context is created.
 */
export function getLogContext() {
  const context = storage.getStore();
  if (!context) return null;
  const userId = context.req?.user?._id;
  return {
    requestId: context.requestId,
    method: context.method,
    url: context.url,
    ...(userId ? { userId: String(userId) } : {}),
  };
}

export function trackRequestStart(entry) {
  activeRequests.set(entry.requestId, entry);
}

export function trackRequestEnd(requestId, result) {
  const entry = activeRequests.get(requestId);
  activeRequests.delete(requestId);
  if (!entry) return;

  recentRequests.push({ ...entry, ...result });
  if (recentRequests.length > MAX_RECENT_REQUESTS) recentRequests.shift();
}

/**
 * Snapshot written into fatal logs: what was running, and what ran just before.
 */
export function getCrashContext() {
  const now = Date.now();
  return {
    inFlightRequests: [...activeRequests.values()].map((entry) => ({
      ...entry,
      runningForMs: now - entry.startedAt,
    })),
    lastRequests: recentRequests.slice(-10),
  };
}
