import { config } from '../config/env.js';
import { getDatabaseHealth } from '../config/db.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { Setting } from '../models/Setting.js';
import { logAudit } from '../services/auditService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLocalIpAddresses, getPrimaryLanIp } from '../utils/network.js';

export const getSettings = asyncHandler(async (_req, res) => {
  const settingsDocs = await Setting.find();
  const settingsMap = Object.fromEntries(settingsDocs.map(({ key, value }) => [key, value]));
  const database = await getDatabaseHealth();
  const primaryLanIp = getPrimaryLanIp();

  return sendSuccess(res, {
    message: API_MESSAGES.SETTINGS.RETRIEVED,
    data: {
      settings: {
        appName: settingsMap.appName || config.appName,
        companyName: settingsMap.companyName || 'Raisoni Group of Institutions',
        currencySymbol: settingsMap.currencySymbol || '₹',
        taxRate: settingsMap.taxRate ?? 18,
        lowStockThreshold: settingsMap.lowStockThreshold || 10,
        ...settingsMap,
      },
      system: {
        appName: config.appName,
        appVersion: config.appVersion,
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
        primaryLanIp,
        lanAddresses: getLocalIpAddresses(),
        port: config.port,
        apiUrl: `http://${primaryLanIp}:${config.port}/api`,
        database,
      },
    },
  });
});

export const updateSetting = asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) throw ApiError.badRequest(API_MESSAGES.SETTINGS.KEY_REQUIRED);

  const setting = await Setting.findOneAndUpdate(
    { key },
    { value, updatedBy: req.user?._id },
    { upsert: true, new: true }
  );

  await logAudit({
    action: 'SETTING_UPDATED',
    entityType: 'Setting',
    entityId: key,
    user: req.user,
    req,
    details: { key, value },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.SETTINGS.UPDATED,
    data: { setting },
  });
});
