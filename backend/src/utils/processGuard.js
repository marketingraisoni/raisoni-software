import { monitorEventLoopDelay } from 'node:perf_hooks';
import { logger as rootLogger } from './logger.js';
import { getCrashContext } from './requestContext.js';

const logger = rootLogger.child({ component: 'process' });

const MONITOR_INTERVAL_MS = 60_000;
const HIGH_MEMORY_BYTES = 800 * 1024 * 1024; // PM2 restarts at 1G (ecosystem.config.cjs)
const HIGH_EVENT_LOOP_DELAY_MS = 500;

let registered = false;
let monitorTimer = null;
let loopDelay = null;

const mb = (bytes) => Math.round(bytes / 1024 / 1024);

/**
 * Registers last-resort handlers so nothing fails silently.
 *
 * - uncaughtException: the process state is unknown, so log FATAL with the requests that
 *   were running and the last ones handled, then let `onFatal` shut down; PM2 restarts it.
 * - unhandledRejection: a promise someone forgot to await failed. Log it with context and
 *   keep serving: every request path already goes through asyncHandler/errorHandler.
 */
export function registerProcessGuards({ onFatal }) {
  if (registered) return;
  registered = true;

  process.on('uncaughtException', (error, origin) => {
    logger.fatal(`Uncaught exception (${origin}): ${error?.message}`, { error, ...getCrashContext() });
    onFatal(error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason?.message || reason}`, {
      error: reason instanceof Error ? reason : { value: String(reason) },
      ...getCrashContext(),
    });
  });

  process.on('warning', (warning) => {
    logger.warn(`Node.js warning ${warning.name}: ${warning.message}`);
  });
}

/** Logs a warning when memory or event-loop delay approach levels that make the server unresponsive. */
export function startResourceMonitor() {
  if (monitorTimer) return;
  loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  monitorTimer = setInterval(() => {
    const memory = process.memoryUsage();
    const loopP99Ms = Math.round(loopDelay.percentile(99) / 1e6);
    loopDelay.reset();

    const snapshot = {
      rssMb: mb(memory.rss),
      heapUsedMb: mb(memory.heapUsed),
      eventLoopP99Ms: loopP99Ms,
      uptimeSeconds: Math.round(process.uptime()),
    };

    if (memory.rss >= HIGH_MEMORY_BYTES) {
      logger.warn('High memory usage; PM2 restarts the backend at 1 GB.', snapshot);
    } else if (loopP99Ms >= HIGH_EVENT_LOOP_DELAY_MS) {
      logger.warn('Event loop is blocked; requests are being delayed.', {
        ...snapshot,
        inFlight: getCrashContext().inFlightRequests,
      });
    } else {
      logger.debug('Resource check', snapshot);
    }
  }, MONITOR_INTERVAL_MS);
  monitorTimer.unref();
}

export function stopResourceMonitor() {
  clearInterval(monitorTimer);
  monitorTimer = null;
  loopDelay?.disable();
  loopDelay = null;
}
