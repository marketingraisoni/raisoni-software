import { PERMISSION_CATALOG } from '../constants/permissions.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_TYPE } from '../constants/user.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/User.js';
import { serializeUser } from '../serializers/userSerializer.js';
import { logAudit } from '../services/auditService.js';
import { canGrantPermissions, normalizePermissions } from '../services/permissionService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function ensureCanManageTarget(actor, target) {
  if (target.userType === USER_TYPE.SUPER_ADMIN && actor.userType !== USER_TYPE.SUPER_ADMIN) {
    throw ApiError.forbidden(API_MESSAGES.AUTH.FORBIDDEN);
  }
}

export const getPermissionCatalog = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    message: API_MESSAGES.PERMISSION.CATALOG_RETRIEVED,
    data: { modules: PERMISSION_CATALOG },
  });
});

export const getUserPermissions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound(API_MESSAGES.USER.NOT_FOUND);
  ensureCanManageTarget(req.user, user);

  return sendSuccess(res, {
    message: API_MESSAGES.PERMISSION.RETRIEVED,
    data: { user: serializeUser(user, { includePermissions: true }) },
  });
});

export const updateUserPermissions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound(API_MESSAGES.USER.NOT_FOUND);
  ensureCanManageTarget(req.user, user);

  const permissions = normalizePermissions(req.body.permissions);
  if (!canGrantPermissions(req.user, permissions)) {
    throw ApiError.forbidden(API_MESSAGES.PERMISSION.CANNOT_GRANT);
  }

  user.permissions = permissions;
  await user.save();
  await logAudit({
    action: 'USER_PERMISSIONS_UPDATED',
    entityType: 'User',
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { permissions },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.PERMISSION.UPDATED,
    data: { user: serializeUser(user, { includePermissions: true }) },
  });
});
