import { USER_TYPE, type UserType } from './user-types'

export const PERMISSION_ACTION = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const

export const PERMISSION_ACTIONS = Object.values(PERMISSION_ACTION) as [
  PermissionAction,
  ...PermissionAction[],
]
export type PermissionAction =
  (typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION]

export const PERMISSION_MODULE = {
  DASHBOARD: 'dashboard',
  USERS: 'users',
  PERMISSIONS: 'permissions',
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  INVENTORY: 'inventory',
  SETTINGS: 'settings',
  LOTS: 'lots',
  ASSORTMENT: 'assortment',
  SEMI_POLISH: 'semi_polish',
  CHAT: 'chat',
} as const

export type PermissionModule =
  (typeof PERMISSION_MODULE)[keyof typeof PERMISSION_MODULE]
export const PERMISSION_MODULES = Object.values(PERMISSION_MODULE) as [
  PermissionModule,
  ...PermissionModule[],
]

const MANAGEABLE_PERMISSION_MODULES = [
  PERMISSION_MODULE.DASHBOARD,
  PERMISSION_MODULE.USERS,
  PERMISSION_MODULE.PERMISSIONS,
  PERMISSION_MODULE.SETTINGS,
  PERMISSION_MODULE.LOTS,
  PERMISSION_MODULE.ASSORTMENT,
  PERMISSION_MODULE.SEMI_POLISH,
  PERMISSION_MODULE.CHAT,
] as const satisfies readonly PermissionModule[]

export type PermissionGrant = {
  module: PermissionModule
  actions: PermissionAction[]
}

export type PermissionCatalogItem = {
  module: PermissionModule
  label: string
  actions: PermissionAction[]
}

type PermissionProfile = 'manager' | 'staff'
type PermissionModuleDefinition = PermissionCatalogItem & {
  defaults: Partial<Record<PermissionProfile, readonly PermissionAction[]>>
}

const ALL_ACTIONS = PERMISSION_ACTIONS
const READ_ONLY = [PERMISSION_ACTION.READ] as const
const READ_UPDATE = [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE] as const

const PERMISSION_MODULE_DEFINITIONS: Record<
  PermissionModule,
  PermissionModuleDefinition
> = {
  [PERMISSION_MODULE.DASHBOARD]: {
    module: PERMISSION_MODULE.DASHBOARD,
    label: 'Dashboard',
    actions: [...READ_ONLY],
    defaults: { manager: READ_ONLY, staff: READ_ONLY },
  },
  [PERMISSION_MODULE.USERS]: {
    module: PERMISSION_MODULE.USERS,
    label: 'User Management',
    actions: [...ALL_ACTIONS],
    defaults: {},
  },
  [PERMISSION_MODULE.PERMISSIONS]: {
    module: PERMISSION_MODULE.PERMISSIONS,
    label: 'Permission Management',
    actions: [...READ_UPDATE],
    defaults: {},
  },
  [PERMISSION_MODULE.CUSTOMERS]: {
    module: PERMISSION_MODULE.CUSTOMERS,
    label: 'Customers',
    actions: [...ALL_ACTIONS],
    defaults: {
      manager: ALL_ACTIONS,
      staff: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
    },
  },
  [PERMISSION_MODULE.PRODUCTS]: {
    module: PERMISSION_MODULE.PRODUCTS,
    label: 'Products',
    actions: [...ALL_ACTIONS],
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: READ_ONLY,
    },
  },
  [PERMISSION_MODULE.ORDERS]: {
    module: PERMISSION_MODULE.ORDERS,
    label: 'Orders',
    actions: [...ALL_ACTIONS],
    defaults: {
      manager: ALL_ACTIONS,
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  [PERMISSION_MODULE.INVENTORY]: {
    module: PERMISSION_MODULE.INVENTORY,
    label: 'Inventory',
    actions: [...READ_UPDATE],
    defaults: { manager: READ_UPDATE, staff: READ_ONLY },
  },
  [PERMISSION_MODULE.SETTINGS]: {
    module: PERMISSION_MODULE.SETTINGS,
    label: 'Settings',
    actions: [...READ_UPDATE],
    defaults: { manager: READ_ONLY },
  },
  [PERMISSION_MODULE.LOTS]: {
    module: PERMISSION_MODULE.LOTS,
    label: 'Lot Management',
    actions: [...ALL_ACTIONS],
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  [PERMISSION_MODULE.ASSORTMENT]: {
    module: PERMISSION_MODULE.ASSORTMENT,
    label: 'Assortment / Packet Creation',
    actions: [...ALL_ACTIONS],
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  [PERMISSION_MODULE.SEMI_POLISH]: {
    module: PERMISSION_MODULE.SEMI_POLISH,
    label: '4P Semi-Polish',
    actions: [...ALL_ACTIONS],
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  [PERMISSION_MODULE.CHAT]: {
    module: PERMISSION_MODULE.CHAT,
    label: 'Chat',
    actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    defaults: {
      manager: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
}

export const PERMISSION_CATALOG: PermissionCatalogItem[] =
  MANAGEABLE_PERMISSION_MODULES.map((module) => {
    const definition = PERMISSION_MODULE_DEFINITIONS[module]
    return { module, label: definition.label, actions: [...definition.actions] }
  })

const fullPermissions = (): PermissionGrant[] =>
  PERMISSION_MODULES.map((module) => ({
    module,
    actions: [...PERMISSION_MODULE_DEFINITIONS[module].actions],
  }))

export function getDefaultPermissions(userType: UserType): PermissionGrant[] {
  if (userType === USER_TYPE.SUPER_ADMIN || userType === USER_TYPE.ADMIN) {
    return fullPermissions()
  }

  const profile: PermissionProfile =
    userType === USER_TYPE.MANAGER ? 'manager' : 'staff'
  return PERMISSION_MODULES.map((module) => ({
    module,
    actions: [
      ...(PERMISSION_MODULE_DEFINITIONS[module].defaults[profile] || []),
    ],
  })).filter(({ actions }) => actions.length > 0)
}

export function hasPermission(
  user:
    | { userType: UserType; permissions?: PermissionGrant[] }
    | null
    | undefined,
  module: PermissionModule,
  action: PermissionAction
) {
  if (user?.userType === USER_TYPE.SUPER_ADMIN) return true
  return Boolean(
    user?.permissions
      ?.find((permission) => permission.module === module)
      ?.actions.includes(action)
  )
}
