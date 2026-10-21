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
