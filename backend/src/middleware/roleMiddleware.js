import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';

export function authorize(...allowedUserTypes) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(API_MESSAGES.AUTH.REQUIRED));
    }

    if (!allowedUserTypes.includes(req.user.userType)) {
      return next(ApiError.forbidden(API_MESSAGES.AUTH.FORBIDDEN));
    }

    return next();
  };
}
