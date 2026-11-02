import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { getLogContext } from './requestContext.js';

/**
 * Application logger.
 *
 * - Console: human readable, one line per entry.
 * - Files (when enabled): JSON lines in `<LOG_DIR>/app-YYYY-MM-DD.log` (everything at or above
 *   LOG_LEVEL) and `<LOG_DIR>/error-YYYY-MM-DD.log` (warnings and errors only), rotated daily
 *   and deleted after LOG_RETENTION_DAYS.
 * - Every entry written while a request is running automatically carries its requestId,
 *   method, url and userId, so one requestId finds every line of a single API call.
 * - Logging never throws: a broken log file falls back to console only.
 */

const LEVELS = Object.freeze({
  debug: 10,
  http: 20,
  info: 30,
  success: 30,
  warn: 40,
  error: 50,
  fatal: 60,
});

const CONSOLE_LABELS = Object.freeze({
  debug: '[DEBUG]',
  http: '[HTTP] ',
  info: '[INFO] ',
  success: '[OK]   ',
  warn: '[WARN] ',
  error: '[ERROR]',
  fatal: '[FATAL]',
});

const REDACTED_KEY = /pass(word)?|token|secret|authorization|cookie|api[-_]?key/i;
const MAX_STRING_LENGTH = 4000;

const minLevel = LEVELS[config.logLevel] ?? LEVELS.info;
let fileLoggingEnabled = config.logToFile;
let currentDate = null;
let appStream = null;
let errorStream = null;

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local wall-clock time with offset, e.g. 2026-11-02T11:53:22.630+05:30 (easier to match with office events).
function localTimestamp(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  return (
    `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
  );
}

function serializeError(error) {
  return {
    name: error.name,
    message: error.message,
    ...(error.code !== undefined ? { code: error.code } : {}),
    ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}),
    stack: error.stack,
    ...(error.cause ? { cause: error.cause instanceof Error ? serializeError(error.cause) : error.cause } : {}),
  };
}

/** Converts metadata to plain JSON-safe data: redacts secrets, expands errors, breaks cycles. */
function sanitize(value, seen = new WeakSet(), depth = 0) {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return serializeError(value);
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (seen.has(value)) return '[Circular]';
  if (depth > 6) return '[Object]';
  seen.add(value);

  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, seen, depth + 1));

  if (typeof value.toHexString === 'function') return value.toHexString(); // Mongo ObjectId

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    result[key] = REDACTED_KEY.test(key) ? '[REDACTED]' : sanitize(item, seen, depth + 1);
  }
  return result;
}

function normalizeMeta(meta) {
  if (meta === undefined || meta === null || meta === '') return undefined;
  if (meta instanceof Error) return { error: serializeError(meta) };
  if (typeof meta !== 'object') return { detail: meta };
  return sanitize(meta);
}

function openStreams(date) {
  closeStreams();
  try {
    fs.mkdirSync(config.logDir, { recursive: true });
    appStream = fs.createWriteStream(path.join(config.logDir, `app-${date}.log`), { flags: 'a' });
    errorStream = fs.createWriteStream(path.join(config.logDir, `error-${date}.log`), { flags: 'a' });
    const onStreamError = (err) => {
      fileLoggingEnabled = false;
      closeStreams();
      console.error(`[ERROR] Log file writing disabled: ${err.message}`);
    };
    appStream.on('error', onStreamError);
    errorStream.on('error', onStreamError);
    currentDate = date;
  } catch (err) {
    fileLoggingEnabled = false;
    console.error(`[ERROR] Could not open log directory ${config.logDir}: ${err.message}`);
  }
}

function closeStreams() {
  appStream?.end();
  errorStream?.end();
  appStream = null;
  errorStream = null;
}

function writeToFiles(level, line, { sync = false } = {}) {
  if (!fileLoggingEnabled) return;
  const date = localDate();

  if (sync) {
    // Used for fatal entries: the process may exit before an async stream flushes.
    try {
      fs.mkdirSync(config.logDir, { recursive: true });
      fs.appendFileSync(path.join(config.logDir, `app-${date}.log`), line);
      fs.appendFileSync(path.join(config.logDir, `error-${date}.log`), line);
    } catch {
      // Logging must never crash the process.
    }
    return;
  }

  if (date !== currentDate || !appStream) openStreams(date);
  if (!appStream) return;
  appStream.write(line);
  if (LEVELS[level] >= LEVELS.warn) errorStream?.write(line);
}

function writeToConsole(level, timestamp, message, context, meta) {
  const requestTag = context?.requestId ? ` [${context.requestId}]` : '';
  const componentTag = meta?.component ? ` (${meta.component})` : '';
  let details = '';
  if (meta) {
    const { component: _component, ...rest } = meta;
    if (Object.keys(rest).length > 0) {
      // Show stack traces on their own lines; they are unreadable inside JSON.
      const stack = rest.error?.stack || rest.stack;
      const compact = { ...rest };
      if (compact.error?.stack) compact.error = { ...compact.error, stack: undefined };
      if (compact.stack) delete compact.stack;
      details = ` ${JSON.stringify(compact)}${stack ? `\n${stack}` : ''}`;
    }
  }

  const output = `${CONSOLE_LABELS[level]} ${timestamp}${requestTag}${componentTag} - ${message}${details}`;
  if (LEVELS[level] >= LEVELS.error) console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

function log(level, message, meta, bindings) {
  if (LEVELS[level] < minLevel && level !== 'fatal') return;

  try {
    const timestamp = localTimestamp();
    const context = getLogContext();
    const normalizedMeta = normalizeMeta(meta);
    const mergedMeta = bindings || normalizedMeta ? { ...bindings, ...normalizedMeta } : undefined;

    writeToConsole(level, timestamp, String(message), context, mergedMeta);

    const entry = {
      time: timestamp,
      level,
      msg: String(message),
      pid: process.pid,
      ...context,
      ...mergedMeta,
    };
    writeToFiles(level, `${JSON.stringify(entry)}\n`, { sync: level === 'fatal' });
  } catch (err) {
    // Last resort: never let a logging problem break a request.
    console.error(`[ERROR] Logger failure: ${err.message} while logging: ${message}`);
  }
}

function createLogger(bindings) {
  return {
    debug: (message, meta) => log('debug', message, meta, bindings),
    http: (message, meta) => log('http', message, meta, bindings),
    info: (message, meta) => log('info', message, meta, bindings),
    success: (message, meta) => log('success', message, meta, bindings),
    warn: (message, meta) => log('warn', message, meta, bindings),
    error: (message, meta) => log('error', message, meta, bindings),
    fatal: (message, meta) => log('fatal', message, meta, bindings),
    /** Logger that tags every entry with extra fields, e.g. logger.child({ component: 'redis' }). */
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();

/** Deletes rotated log files older than LOG_RETENTION_DAYS. */
export function cleanupOldLogs() {
  if (!fileLoggingEnabled) return 0;
  const cutoff = Date.now() - config.logRetentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    for (const file of fs.readdirSync(config.logDir)) {
      if (!/^(app|error)-\d{4}-\d{2}-\d{2}\.log$/.test(file)) continue;
      const filePath = path.join(config.logDir, file);
      if (fs.statSync(filePath).mtimeMs < cutoff) {
        fs.rmSync(filePath, { force: true });
        removed++;
      }
    }
  } catch {
    // Directory may not exist yet.
  }
  return removed;
}

let cleanupTimer = null;
export function startLogMaintenance() {
  if (cleanupTimer || !fileLoggingEnabled) return;
  const removed = cleanupOldLogs();
  if (removed > 0) logger.info(`Removed ${removed} log file(s) older than ${config.logRetentionDays} days.`);
  cleanupTimer = setInterval(cleanupOldLogs, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();
}

/** Flushes and closes log files. Call right before a planned process exit. */
export function closeLogger() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  const streams = [appStream, errorStream].filter(Boolean);
  appStream = null;
  errorStream = null;
  currentDate = null;
  return Promise.all(
    streams.map((stream) => new Promise((resolve) => stream.end(resolve)))
  );
}
