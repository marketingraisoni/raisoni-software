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
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({
  path: path.join(projectRoot, `.env.${environment}`),
  override: true
});

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
  isStaging: environment === 'staging',
  isProduction: environment === 'production',
  port,
  host: process.env.HOST || '0.0.0.0',
  databaseName,
  mongoUri:
    process.env.MONGODB_URI ||
    `mongodb://127.0.0.1:27017/${databaseName}`,
  useEmbedded: process.env.USE_EMBEDDED_MONGODB === 'true',
  useEmbeddedFallback: process.env.USE_EMBEDDED_MONGODB_FALLBACK === 'true',
  dataDir,
  jwtSecret:
    process.env.JWT_SECRET ||
    'fallback_development_secret_only_never_use_in_production_32char',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appName: process.env.APP_NAME || 'Raisoni ERP',
  appVersion: process.env.APP_VERSION || '1.0.0',
  autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED === 'true',
  backupIntervalHours,
  backupRetentionDays
});

function parseInteger(value, fallback, variableName) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${variableName} must be an integer between 1 and 65535.`);
  }
  return parsed;
}
