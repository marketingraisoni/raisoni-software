import { Router } from 'express';
import { getDatabaseHealth } from '../config/db.js';
import { config } from '../config/env.js';
import { API_MESSAGES } from '../constants/messages.js';
import { getLocalIpAddresses, getPrimaryLanIp } from '../utils/network.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

const router = Router();

// Desktop startup needs a cheap readiness check, not collection enumeration or
// replica-set diagnostics. Bound the ping so a lost database never hangs startup.
router.get('/ready', asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  let connected = false;
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    try {
      await mongoose.connection.db.admin().ping({ timeoutMS: 1500 });
      connected = true;
    } catch { /* Database is not ready for application requests. */ }
  }
  return res.status(connected ? 200 : 503).json({
    success: connected,
    data: { status: connected ? 'ok' : 'unavailable', database: { connected } }
  });
}));

router.get('/', asyncHandler(async (_req, res) => {
  const database = await getDatabaseHealth();
  const primaryLanIp = getPrimaryLanIp();

  return sendSuccess(res, {
    message: API_MESSAGES.HEALTH.HEALTHY,
    data: {
      status: 'ok',
      appName: config.appName,
      version: config.appVersion,
      environment: config.env,
      databaseName: config.databaseName,
      timestamp: new Date().toISOString(),
      primaryLanIp,
      lanAddresses: getLocalIpAddresses(),
      database,
      serverPort: config.port,
    },
  });
}));

export default router;
