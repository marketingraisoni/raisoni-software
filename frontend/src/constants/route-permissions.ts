import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  type PermissionAction,
  type PermissionModule,
} from './permissions'

export type AuthenticatedRoutePermission = {
  module: PermissionModule
  action: PermissionAction
}

type RoutePermissionRule = AuthenticatedRoutePermission & {
  path: string
  exact?: boolean
}

export const AUTHENTICATED_ROUTE_PERMISSIONS: readonly RoutePermissionRule[] = [
  {
    path: '/semi-polish/packet-scanner',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.UPDATE,
    exact: true,
  },
  {
    path: '/semi-polish/packet-return',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.UPDATE,
    exact: true,
  },
  {
    path: '/semi-polish/planning-returns',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.UPDATE,
  },
  {
    path: '/semi-polish/ready-for-issue',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.CREATE,
    exact: true,
  },
  {
    path: '/packet-scanner',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.UPDATE,
    exact: true,
  },
  {
    path: '/packet-return',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.UPDATE,
    exact: true,
  },
  {
    path: '/semi-polish',
    module: PERMISSION_MODULE.SEMI_POLISH,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/packets',
    module: PERMISSION_MODULE.ASSORTMENT,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/lots',
    module: PERMISSION_MODULE.LOTS,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/permissions',
    module: PERMISSION_MODULE.PERMISSIONS,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/users',
    module: PERMISSION_MODULE.USERS,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/settings',
    module: PERMISSION_MODULE.SETTINGS,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/chats',
    module: PERMISSION_MODULE.CHAT,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/chat',
    module: PERMISSION_MODULE.CHAT,
    action: PERMISSION_ACTION.READ,
  },
  {
    path: '/',
    module: PERMISSION_MODULE.DASHBOARD,
    action: PERMISSION_ACTION.READ,
    exact: true,
  },
]

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '')
}

export function getAuthenticatedRoutePermission(
  pathname: string
): AuthenticatedRoutePermission | null {
  const normalizedPathname = normalizePathname(pathname)
  const rule = AUTHENTICATED_ROUTE_PERMISSIONS.find(({ path, exact }) =>
    exact
      ? normalizedPathname === path
      : normalizedPathname === path || normalizedPathname.startsWith(`${path}/`)
  )

  return rule ? { module: rule.module, action: rule.action } : null
}
