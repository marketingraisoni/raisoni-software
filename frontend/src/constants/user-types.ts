export const USER_TYPE = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  MANAGER: 3,
  STAFF: 4,
} as const

export type UserType = (typeof USER_TYPE)[keyof typeof USER_TYPE]

export const USER_TYPE_LABEL: Record<UserType, string> = {
  [USER_TYPE.SUPER_ADMIN]: 'Super Admin',
  [USER_TYPE.ADMIN]: 'Administrator',
  [USER_TYPE.MANAGER]: 'Manager',
  [USER_TYPE.STAFF]: 'Staff',
}

export function legacyRoleToUserType(role?: string): UserType {
  if (role === 'super_admin') return USER_TYPE.SUPER_ADMIN
  if (role === 'admin') return USER_TYPE.ADMIN
  if (role === 'manager') return USER_TYPE.MANAGER
  return USER_TYPE.STAFF
}
