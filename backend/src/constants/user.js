export const USER_TYPE = Object.freeze({
  SUPER_ADMIN: 1,
  ADMIN: 2,
  MANAGER: 3,
  STAFF: 4,
});

export const USER_TYPES = Object.freeze(Object.values(USER_TYPE));

export const USER_TYPE_LABEL = Object.freeze({
  [USER_TYPE.SUPER_ADMIN]: 'Super Admin',
  [USER_TYPE.ADMIN]: 'Administrator',
  [USER_TYPE.MANAGER]: 'Manager',
  [USER_TYPE.STAFF]: 'Staff',
});

export const LEGACY_ROLE_TO_USER_TYPE = Object.freeze({
  super_admin: USER_TYPE.SUPER_ADMIN,
  admin: USER_TYPE.ADMIN,
  manager: USER_TYPE.MANAGER,
  staff: USER_TYPE.STAFF,
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

export const USER_STATUSES = Object.freeze(Object.values(USER_STATUS));

export const USER_SORT_FIELDS = Object.freeze([
  'username',
  'name',
  'email',
  'status',
  'userType',
  'lastLogin',
  'createdAt',
]);
