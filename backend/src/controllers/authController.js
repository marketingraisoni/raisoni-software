import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_STATUS } from '../constants/user.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/User.js';
import { serializeUser } from '../serializers/userSerializer.js';
import { logAudit } from '../services/auditService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const profileUploadsDir = path.resolve(config.dataDir, 'uploads/profile');
const profilePhotoTypes = Object.freeze({
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

async function removeStoredProfilePhoto(avatarUrl) {
  if (!avatarUrl?.startsWith('/uploads/profile/')) return;

  const filename = path.basename(avatarUrl);
  await fs.promises.rm(path.join(profileUploadsDir, filename), { force: true });
}

export const login = asyncHandler(async (req, res) => {
  const { username, password, rememberMe } = req.body;
  const loginIdentifier = username.toLowerCase();

  const user = await User.findOne({
    $or: [{ username: loginIdentifier }, { email: loginIdentifier }],
  }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized(API_MESSAGES.AUTH.INVALID_CREDENTIALS);
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden(API_MESSAGES.AUTH.ACCOUNT_INACTIVE);
  }

  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign(
    { id: user._id, username: user.username, userType: user.userType },
    config.jwtSecret,
    {
      expiresIn: rememberMe
        ? config.jwtRememberMeExpiresIn
        : config.jwtExpiresIn,
    },
  );

  await logAudit({
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user._id.toString(),
    user,
    req,
    details: { userType: user.userType, rememberMe },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.LOGIN_SUCCESS,
    data: {
      user: serializeUser(user, { includePermissions: true }),
      userType: user.userType,
      token,
    },
  });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.CURRENT_USER_SUCCESS,
    data: { user: serializeUser(req.user, { includePermissions: true }) },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, username } = req.body;
  const user = await User.findById(req.user._id);

  if (username !== user.username) {
    const usernameOwner = await User.exists({
      username,
      _id: { $ne: user._id },
    });
    if (usernameOwner) {
      throw ApiError.conflict(API_MESSAGES.USER.USERNAME_EXISTS, [
        { field: 'username', message: API_MESSAGES.USER.USERNAME_EXISTS },
      ]);
    }
  }

  user.name = name;
  user.username = username;
  await user.save();

  await logAudit({
    action: 'PROFILE_UPDATED',
    entityType: 'User',
    entityId: user._id.toString(),
    user,
    req,
    details: { name: user.name, username: user.username },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.PROFILE_UPDATED,
    data: { user: serializeUser(user, { includePermissions: true }) },
  });
});

export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  const mimeType = String(req.headers['content-type'] || '').split(';')[0];
  const extension = profilePhotoTypes[mimeType];
  if (
    !extension ||
    !Buffer.isBuffer(req.body) ||
    req.body.length === 0 ||
    !hasExpectedImageSignature(req.body, mimeType)
  ) {
    throw ApiError.badRequest('Choose a JPG, PNG, or WebP image.');
  }

  const maxBytes = 5 * 1024 * 1024;
  if (req.body.length > maxBytes) {
    throw ApiError.badRequest('Profile picture cannot exceed 5 MB.');
  }

  await fs.promises.mkdir(profileUploadsDir, { recursive: true });
  const filename = `${req.user._id}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  await fs.promises.writeFile(path.join(profileUploadsDir, filename), req.body);

  const user = await User.findById(req.user._id);
  const previousAvatarUrl = user.avatarUrl;
  user.avatarUrl = `/uploads/profile/${filename}`;
  await user.save();
  await removeStoredProfilePhoto(previousAvatarUrl);

  await logAudit({
    action: 'PROFILE_PHOTO_UPDATED',
    entityType: 'User',
    entityId: user._id.toString(),
    user,
    req,
  });

  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.PROFILE_PHOTO_UPDATED,
    data: { user: serializeUser(user, { includePermissions: true }) },
  });
});

export const removeProfilePhoto = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const previousAvatarUrl = user.avatarUrl;
  user.avatarUrl = '';
  await user.save();
  await removeStoredProfilePhoto(previousAvatarUrl);

  await logAudit({
    action: 'PROFILE_PHOTO_REMOVED',
    entityType: 'User',
    entityId: user._id.toString(),
    user,
    req,
  });

  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.PROFILE_PHOTO_REMOVED,
    data: { user: serializeUser(user, { includePermissions: true }) },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest(API_MESSAGES.AUTH.CURRENT_PASSWORD_INVALID);
  }

  user.password = newPassword;
  await user.save();

  await logAudit({
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user._id.toString(),
    user,
    req,
  });

  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.PASSWORD_CHANGED,
    data: null,
  });
});

export const logout = asyncHandler(async (req, res) => {
  await logAudit({
    action: 'USER_LOGOUT',
    entityType: 'User',
    entityId: req.user._id.toString(),
    user: req.user,
    req,
  });

  return sendSuccess(res, {
    message: API_MESSAGES.AUTH.LOGOUT_SUCCESS,
    data: null,
  });
});
