import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_STATUS } from '../constants/user.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized(API_MESSAGES.AUTH.TOKEN_MISSING);
  }

  const token = authHeader.slice(7).trim();
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized(API_MESSAGES.AUTH.TOKEN_EXPIRED);
    }
    throw ApiError.unauthorized(API_MESSAGES.AUTH.TOKEN_INVALID);
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw ApiError.unauthorized(API_MESSAGES.AUTH.TOKEN_USER_MISSING);
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden(API_MESSAGES.AUTH.ACCOUNT_INACTIVE);
  }

  req.user = user;
  return next();
});
