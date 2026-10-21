import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_TYPE, USER_STATUS } from '../constants/user.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/User.js';
import { serializeUser } from '../serializers/userSerializer.js';
import { logAudit } from '../services/auditService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta } from '../utils/pagination.js';
import {
  getDefaultPermissions,
} from '../services/permissionService.js';

async function ensureAdminCanChange(user, updates) {
  const privilegedTypes = [USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN];
  const removesActiveAdmin =
    privilegedTypes.includes(user.userType) &&
    (updates.userType !== undefined && !privilegedTypes.includes(updates.userType) ||
      updates.status === USER_STATUS.INACTIVE);

  if (!removesActiveAdmin) return;

  const activeAdmins = await User.countDocuments({
    userType: { $in: privilegedTypes },
    status: USER_STATUS.ACTIVE,
  });

  if (activeAdmins <= 1) {
    throw ApiError.badRequest(API_MESSAGES.USER.ONLY_ADMIN);
  }
}

function ensureCanManageSuperAdmin(actor, currentUserType, nextUserType) {
  const touchesSuperAdmin =
    currentUserType === USER_TYPE.SUPER_ADMIN ||
    nextUserType === USER_TYPE.SUPER_ADMIN;

  if (touchesSuperAdmin && actor.userType !== USER_TYPE.SUPER_ADMIN) {
    throw ApiError.forbidden(API_MESSAGES.AUTH.FORBIDDEN);
  }
}

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, status, userType, sortBy, sortOrder } = req.query;
  const query = {};

  if (search) {
    const escapedSearch = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const pattern = new RegExp(escapedSearch, 'i');
    query.$or = [
      { username: pattern },
      { name: pattern },
      { email: pattern },
    ];
  }

  if (status.length > 0) query.status = { $in: status };
  if (userType.length > 0) query.userType = { $in: userType };

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select('-permissions')
      .sort({ [sortBy]: sortDirection, _id: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.USER.LIST_SUCCESS,
    data: {
      users: users.map((u) => serializeUser(u, { includePermissions: false })),
      pagination: createPaginationMeta({ page, limit, total }),
    },
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, username, email, password, userType, status, notes } = req.body;
  ensureCanManageSuperAdmin(req.user, undefined, userType);
  const permissions = getDefaultPermissions(userType);

  if (await User.exists({ username })) {
    throw ApiError.conflict(API_MESSAGES.USER.USERNAME_EXISTS, [
      { field: 'username', message: API_MESSAGES.USER.USERNAME_EXISTS },
    ]);
  }

  if (await User.exists({ email })) {
    throw ApiError.conflict(API_MESSAGES.USER.EMAIL_EXISTS, [
      { field: 'email', message: API_MESSAGES.USER.EMAIL_EXISTS },
    ]);
  }

  const user = await User.create({
    name,
    username,
    email,
    password,
    userType,
    status,
    notes,
    permissions,
  });

  await logAudit({
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { username: user.username, userType: user.userType },
  });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.USER.CREATED,
    data: { user: serializeUser(user, { includePermissions: false }) },
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound(API_MESSAGES.USER.NOT_FOUND);

  ensureCanManageSuperAdmin(req.user, user.userType, req.body.userType);
  await ensureAdminCanChange(user, req.body);

  if (req.body.email && req.body.email !== user.email) {
    const emailOwner = await User.exists({ email: req.body.email, _id: { $ne: user._id } });
    if (emailOwner) throw ApiError.conflict(API_MESSAGES.USER.EMAIL_EXISTS);
  }

  const editableFields = ['name', 'email', 'password', 'userType', 'status', 'notes'];
  for (const field of editableFields) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  await user.save();

  await logAudit({
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { username: user.username, userType: user.userType, status: user.status },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.USER.UPDATED,
    data: { user: serializeUser(user, { includePermissions: false }) },
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound(API_MESSAGES.USER.NOT_FOUND);

  ensureCanManageSuperAdmin(req.user, user.userType, undefined);

  if (user._id.equals(req.user._id)) {
    throw ApiError.badRequest(API_MESSAGES.USER.DELETE_SELF);
  }

  if ([USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN].includes(user.userType)) {
    const activeAdmins = await User.countDocuments({
      userType: { $in: [USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN] },
      status: USER_STATUS.ACTIVE,
    });
    if (activeAdmins <= 1) {
      throw ApiError.badRequest(API_MESSAGES.USER.DELETE_ONLY_ADMIN);
    }
  }

  await user.deleteOne();

  await logAudit({
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { username: user.username },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.USER.DELETED,
    data: { id: user._id.toString() },
  });
});
