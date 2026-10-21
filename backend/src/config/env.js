import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/raisoni_software_demo',
  useEmbeddedFallback: process.env.USE_EMBEDDED_MONGODB_FALLBACK === 'true',
  jwtSecret: process.env.JWT_SECRET || 'fallback_development_secret_only_never_use_in_production_32char',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appName: process.env.APP_NAME || 'Raisoni Software Demo',
  appVersion: process.env.APP_VERSION || '1.0.0'
};
