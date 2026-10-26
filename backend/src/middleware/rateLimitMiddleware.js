import rateLimit from 'express-rate-limit';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(
    ApiError.tooManyRequests(API_MESSAGES.AUTH.LOGIN_RATE_LIMITED)
  ),
});

export const assortmentWriteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Authentication runs before the lot router, so this limits each user
  // independently even when many office users share one public IP address.
  keyGenerator: (req) => String(req.user._id),
  handler: (_req, _res, next) => next(
    ApiError.tooManyRequests(API_MESSAGES.PACKET.WRITE_RATE_LIMITED)
  ),
});
