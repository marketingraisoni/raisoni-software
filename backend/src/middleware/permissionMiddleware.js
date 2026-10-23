import { API_MESSAGES } from "../constants/messages.js";
import { ApiError } from "../errors/ApiError.js";
import { hasPermission } from "../services/permissionService.js";
import { PERMISSION_ACTION } from "../constants/permissions.js";

const METHOD_PERMISSION_ACTION = Object.freeze({
  GET: PERMISSION_ACTION.READ,
  HEAD: PERMISSION_ACTION.READ,
  OPTIONS: PERMISSION_ACTION.READ,
  POST: PERMISSION_ACTION.CREATE,
  PUT: PERMISSION_ACTION.UPDATE,
  PATCH: PERMISSION_ACTION.UPDATE,
  DELETE: PERMISSION_ACTION.DELETE,
});

export function permit(module, actionOverride) {
  return (req, _res, next) => {
    if (!req.user)
      return next(ApiError.unauthorized(API_MESSAGES.AUTH.REQUIRED));
    const action = actionOverride || METHOD_PERMISSION_ACTION[req.method];
    if (!action) {
      return next(ApiError.forbidden(API_MESSAGES.AUTH.FORBIDDEN));
    }
    if (!hasPermission(req.user, module, action)) {
      return next(ApiError.forbidden(API_MESSAGES.AUTH.FORBIDDEN));
    }
    return next();
  };
}
