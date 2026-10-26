import {
  PERMISSION_ACTION,
  hasPermission,
  type PermissionAction,
  type PermissionModule,
} from '@/constants/permissions'
import { sidebarData } from './data/sidebar-data'

type PermissionUser = Parameters<typeof hasPermission>[0]

type NavigationPermissionItem = {
  permission?: {
    module: PermissionModule
    action?: PermissionAction
  }
}

export function canAccessNavigationItem(
  user: PermissionUser,
  item: NavigationPermissionItem
) {
  if (!item.permission) return true

  return hasPermission(
    user,
    item.permission.module,
    item.permission.action || PERMISSION_ACTION.READ
  )
}

export function getFirstAccessibleNavigationRoute(user: PermissionUser) {
  if (!user) return '/'

  for (const group of sidebarData.navGroups) {
    for (const item of group.items) {
      if (!canAccessNavigationItem(user, item)) continue

      if ('url' in item && typeof item.url === 'string') return item.url

      if ('items' in item && item.items) {
        const firstAccessibleItem = item.items.find((child) =>
          canAccessNavigationItem(user, child)
        )

        if (firstAccessibleItem) return firstAccessibleItem.url
      }
    }
  }

  return '/403'
}
