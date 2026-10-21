import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_STATUS } from '../constants/user.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/User.js';
import { serializeUser } from '../serializers/userSerializer.js';
import { logAudit } from '../services/auditService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
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
    { expiresIn: config.jwtExpiresIn }
  );

  await logAudit({
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user._id.toString(),
    user,
    req,
    details: { userType: user.userType },
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
