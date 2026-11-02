import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ENVIRONMENT_DEFAULTS,
  resolveEnvironmentName
} from './environments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

const environment = resolveEnvironmentName(process.env.APP_ENV);
// Precedence: real process env (PM2, cross-env, Electron) > .env.<environment> > .env
// dotenv never overwrites a key that is already set, so load the most specific file first.
dotenv.config({ path: path.join(projectRoot, `.env.${environment}`), quiet: true });
dotenv.config({ path: path.join(projectRoot, '.env'), quiet: true });

const defaults = ENVIRONMENT_DEFAULTS[environment];

const port = parseInteger(process.env.PORT, defaults.port, 'PORT');
const databaseName = process.env.DATABASE_NAME || defaults.databaseName;
const backupIntervalHours = parseInteger(
  process.env.BACKUP_INTERVAL_HOURS,
  6,
  'BACKUP_INTERVAL_HOURS'
);
const backupRetentionDays = parseInteger(
  process.env.BACKUP_RETENTION_DAYS,
  30,
  'BACKUP_RETENTION_DAYS'
);
const dataDir = path.resolve(
  process.env.RAISONI_DATA_DIR || path.join(projectRoot, 'data', environment)
);

export const config = Object.freeze({
  env: environment,
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
  port,
  host: process.env.HOST || '0.0.0.0',
  databaseName,
  mongoUri:
    process.env.MONGODB_URI ||
    `mongodb://127.0.0.1:27017/${databaseName}`,
  useEmbedded: process.env.USE_EMBEDDED_MONGODB === 'true',
  useEmbeddedFallback:
    Boolean(process.versions.electron) ||
    process.env.USE_EMBEDDED_MONGODB_FALLBACK === 'true' ||
    process.env.USE_EMBEDDED_MONGODB_FALLBACK === undefined,
  // MongoDB service may still be starting when the PC boots; keep retrying before giving up.
  mongoConnectRetries: parseNonNegativeInteger(process.env.MONGODB_CONNECT_RETRIES, 1),
  mongoRetryDelayMs: parseNonNegativeInteger(process.env.MONGODB_RETRY_DELAY_MS, 3000),
  projectRoot,
  dataDir,
  jwtSecret:
    process.env.JWT_SECRET ||
    'fallback_development_secret_only_never_use_in_production_32char',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRememberMeExpiresIn: process.env.JWT_REMEMBER_ME_EXPIRES_IN || '30d',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appName: process.env.APP_NAME || 'Raisoni ERP',
  appVersion: process.env.APP_VERSION || '1.0.0',
  // LAN discovery lets desktop apps find this server without a configured IP.
  // On by default only in production so dev backends never answer client searches.
  discoveryEnabled: process.env.DISCOVERY_ENABLED
    ? process.env.DISCOVERY_ENABLED === 'true'
    : environment === 'production',
  discoveryPort: parseInteger(process.env.DISCOVERY_PORT, 47800, 'DISCOVERY_PORT'),
  autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED === 'true',
  backupIntervalHours,
  backupRetentionDays,
  // Redis is optional: caching and rate limiting fall back to process memory when it is offline.
  redisEnabled: process.env.REDIS_ENABLED !== 'false',
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: parseInteger(process.env.REDIS_PORT, 6379, 'REDIS_PORT'),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisDb: parseNonNegativeInteger(process.env.REDIS_DB, 0),
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || `raisoni:${environment}:`,
  redisConnectTimeoutMs: parsePositiveInteger(process.env.REDIS_CONNECT_TIMEOUT_MS, 2000),
  // A hung Redis must never hang an API request; slow commands fail over to memory.
  redisCommandTimeoutMs: parsePositiveInteger(process.env.REDIS_COMMAND_TIMEOUT_MS, 1000),

  // Logging
  logLevel: resolveLogLevel(process.env.LOG_LEVEL, environment),
  logDir: path.resolve(process.env.LOG_DIR || path.join(dataDir, 'logs')),
  // node --test sets NODE_TEST_CONTEXT; keep test runs out of the real log files.
  logToFile: process.env.LOG_TO_FILE
    ? process.env.LOG_TO_FILE === 'true'
    : !process.env.NODE_TEST_CONTEXT,
  logRetentionDays: parsePositiveInteger(process.env.LOG_RETENTION_DAYS, 30),
  slowRequestMs: parsePositiveInteger(process.env.SLOW_REQUEST_MS, 3000),
});

function resolveLogLevel(value, environmentName) {
  const allowed = ['debug', 'http', 'info', 'warn', 'error'];
  const normalized = String(value || '').trim().toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  return environmentName === 'development' ? 'debug' : 'http';
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseInteger(value, fallback, variableName) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${variableName} must be an integer between 1 and 65535.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
