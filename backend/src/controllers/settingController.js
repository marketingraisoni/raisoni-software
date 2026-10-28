import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { getDatabaseHealth } from '../config/db.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { Setting } from '../models/Setting.js';
import { logAudit } from '../services/auditService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLocalIpAddresses, getPrimaryLanIp } from '../utils/network.js';

const supportContactDefaults = Object.freeze({
  administratorName: 'Raisoni Jauharis',
  administratorEmail: 'raisonijauharis@gmail.com',
  administratorPhone: '9913412511',
  softwareDepartmentName: 'Software Department',
  softwareDepartmentEmail: 'marketing.raisoni@gmail.com',
  softwareDepartmentPhone: '9974602511',
});

const brandingUploadsDir = path.resolve(config.dataDir, 'uploads/branding');
const brandingImageTypes = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

function hasExpectedImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

async function removeStoredBrandingImage(imageUrl) {
  if (!imageUrl?.startsWith('/uploads/branding/')) return;
  await fs.promises.rm(
    path.join(brandingUploadsDir, path.basename(imageUrl)),
    { force: true },
  );
}

export const getPublicBranding = asyncHandler(async (_req, res) => {
  const settingsDocs = await Setting.find({
    key: { $in: ['appName', 'loginImageUrl'] },
  }).lean();
  const settings = Object.fromEntries(
    settingsDocs.map(({ key, value }) => [key, value]),
  );
  const savedLoginImageUrl =
    typeof settings.loginImageUrl === 'string'
      ? settings.loginImageUrl.trim()
      : '';
  const savedAppName =
    typeof settings.appName === 'string' ? settings.appName.trim() : '';

  res.set('Cache-Control', 'no-store');

  return sendSuccess(res, {
    message: 'Public branding retrieved successfully',
    data: {
      branding: {
        appName: savedAppName || config.appName,
        loginImageUrl: savedLoginImageUrl,
      },
    },
  });
});

export const uploadLoginImage = asyncHandler(async (req, res) => {
  const mimeType = String(req.headers['content-type'] || '').split(';')[0];
  const extension = brandingImageTypes[mimeType];
  if (
    !extension ||
    !Buffer.isBuffer(req.body) ||
    req.body.length === 0 ||
    !hasExpectedImageSignature(req.body, mimeType)
  ) {
    throw ApiError.badRequest('Choose a JPG, PNG, or WebP image.');
  }

  const maxBytes = 8 * 1024 * 1024;
  if (req.body.length > maxBytes) {
    throw ApiError.badRequest('Login image cannot exceed 8 MB.');
  }

  await fs.promises.mkdir(brandingUploadsDir, { recursive: true });
  const filename = `login-${crypto.randomBytes(12).toString('hex')}${extension}`;
  const filePath = path.join(brandingUploadsDir, filename);
  await fs.promises.writeFile(filePath, req.body);

  const imageUrl = `/uploads/branding/${filename}`;
  const previousSetting = await Setting.findOne({ key: 'loginImageUrl' }).lean();
  try {
    await Setting.findOneAndUpdate(
      { key: 'loginImageUrl' },
      {
        value: imageUrl,
        category: 'branding',
        description: 'Image shown on the right side of the sign-in page',
        updatedBy: req.user._id,
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    await fs.promises.rm(filePath, { force: true });
    throw error;
  }
  await removeStoredBrandingImage(previousSetting?.value);

  await logAudit({
    action: 'LOGIN_BRANDING_IMAGE_UPDATED',
    entityType: 'Setting',
    entityId: 'loginImageUrl',
    user: req.user,
    req,
    details: { imageUrl },
  });

  return sendSuccess(res, {
    message: 'Login image updated successfully',
    data: {
      branding: { appName: config.appName, loginImageUrl: imageUrl },
    },
  });
});

export const getSupportContacts = asyncHandler(async (_req, res) => {
  const keys = Object.keys(supportContactDefaults);
  const settingsDocs = await Setting.find({ key: { $in: keys } }).lean();
  const savedContacts = Object.fromEntries(
    settingsDocs.map(({ key, value }) => [key, value]),
  );

  return sendSuccess(res, {
    message: 'Support contacts retrieved successfully',
    data: {
      contacts: { ...supportContactDefaults, ...savedContacts },
    },
  });
});

export const getSettings = asyncHandler(async (_req, res) => {
  const settingsDocs = await Setting.find();
  const settingsMap = Object.fromEntries(
    settingsDocs.map(({ key, value }) => [key, value]),
  );
  const database = await getDatabaseHealth();
  const primaryLanIp = getPrimaryLanIp();

  return sendSuccess(res, {
    message: API_MESSAGES.SETTINGS.RETRIEVED,
    data: {
      settings: {
        appName: settingsMap.appName || config.appName,
        companyName: settingsMap.companyName || 'Raisoni Jauharis',
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
  if (key === 'loginImageUrl') {
    throw ApiError.badRequest(
      'Use the Login Branding upload module to change this image.',
    );
  }

  const setting = await Setting.findOneAndUpdate(
    { key },
    { value, updatedBy: req.user?._id },
    { upsert: true, new: true },
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
