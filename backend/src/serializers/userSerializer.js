export function serializeUser(user, options = {}) {
  if (!user) return null;

  const value = typeof user.toObject === 'function' ? user.toObject() : user;

  const serialized = {
    id: String(value._id ?? value.id),
    name: value.name,
    username: value.username,
    email: value.email,
    avatarUrl: value.avatarUrl ?? '',
    userType: value.userType,
    status: value.status,
    notes: value.notes ?? '',
    lastLogin: value.lastLogin ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (options.includePermissions === true && Array.isArray(value.permissions)) {
    serialized.permissions = value.permissions.map((permission) => ({
      module: permission.module,
      actions: [...permission.actions],
    }));
  }

  return serialized;
}
