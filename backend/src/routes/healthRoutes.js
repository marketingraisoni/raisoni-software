import { Router } from 'express';
import { getDatabaseHealth } from '../config/db.js';
import { config } from '../config/env.js';
import { API_MESSAGES } from '../constants/messages.js';
import { getLocalIpAddresses, getPrimaryLanIp } from '../utils/network.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const database = await getDatabaseHealth();
  const primaryLanIp = getPrimaryLanIp();

  return sendSuccess(res, {
    message: API_MESSAGES.HEALTH.HEALTHY,
    data: {
      status: 'ok',
      appName: config.appName,
      version: config.appVersion,
      timestamp: new Date().toISOString(),
      primaryLanIp,
      lanAddresses: getLocalIpAddresses(),
      database,
      serverPort: config.port,
    },
  });
}));

export default router;
