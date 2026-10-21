import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { hasPermission } from '../services/permissionService.js';

export function permit(module, action) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized(API_MESSAGES.AUTH.REQUIRED));
    if (!hasPermission(req.user, module, action)) {
      return next(ApiError.forbidden(API_MESSAGES.AUTH.FORBIDDEN));
    }
    return next();
  };
}
