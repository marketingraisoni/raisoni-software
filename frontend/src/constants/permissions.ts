import { USER_TYPE, type UserType } from './user-types'

export const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export const PERMISSION_MODULES = [
  'dashboard',
  'users',
  'customers',
  'products',
  'orders',
  'inventory',
  'settings',
  'lots',
] as const
export type PermissionModule = (typeof PERMISSION_MODULES)[number]

export type PermissionGrant = {
  module: PermissionModule
  actions: PermissionAction[]
}

export type PermissionCatalogItem = {
  module: PermissionModule
  label: string
  actions: PermissionAction[]
}

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { module: 'dashboard', label: 'Dashboard', actions: ['read'] },
  { module: 'users', label: 'Users', actions: [...PERMISSION_ACTIONS] },
  { module: 'customers', label: 'Customers', actions: [...PERMISSION_ACTIONS] },
  { module: 'products', label: 'Products', actions: [...PERMISSION_ACTIONS] },
  { module: 'orders', label: 'Orders', actions: [...PERMISSION_ACTIONS] },
  { module: 'inventory', label: 'Inventory', actions: ['read', 'update'] },
  { module: 'settings', label: 'Settings', actions: ['read', 'update'] },
  { module: 'lots', label: 'Lots', actions: [...PERMISSION_ACTIONS] },
]

const fullPermissions = (): PermissionGrant[] =>
  PERMISSION_CATALOG.map(({ module, actions }) => ({ module, actions: [...actions] }))

export function getDefaultPermissions(userType: UserType): PermissionGrant[] {
  if (userType === USER_TYPE.SUPER_ADMIN || userType === USER_TYPE.ADMIN) {
    return fullPermissions()
  }

  if (userType === USER_TYPE.MANAGER) {
    return [
      { module: 'dashboard', actions: ['read'] },
      { module: 'customers', actions: [...PERMISSION_ACTIONS] },
      { module: 'products', actions: ['read', 'create', 'update'] },
      { module: 'orders', actions: [...PERMISSION_ACTIONS] },
      { module: 'inventory', actions: ['read', 'update'] },
      { module: 'settings', actions: ['read'] },
      { module: 'lots', actions: ['read', 'create', 'update'] },
    ]
  }

  return [
    { module: 'dashboard', actions: ['read'] },
    { module: 'customers', actions: ['read', 'create', 'update'] },
    { module: 'products', actions: ['read'] },
    { module: 'orders', actions: ['read', 'create'] },
    { module: 'inventory', actions: ['read'] },
    { module: 'lots', actions: ['read', 'create'] },
  ]
}

export function hasPermission(
  user: { userType: UserType; permissions?: PermissionGrant[] } | null | undefined,
  module: PermissionModule,
  action: PermissionAction
) {
  if (user?.userType === USER_TYPE.SUPER_ADMIN) return true
  return Boolean(
    user?.permissions?.find((permission) => permission.module === module)?.actions.includes(action)
  )
}
