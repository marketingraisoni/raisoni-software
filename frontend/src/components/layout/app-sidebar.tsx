import { useAuthStore } from '@/stores/auth-store'
import { PERMISSION_ACTION, hasPermission } from '@/constants/permissions'
import { USER_TYPE_LABEL } from '@/constants/user-types'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import type { NavItem } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user = useAuthStore((state) => state.auth.user)
  const filterNavItem = (item: NavItem): NavItem | null => {
    if (
      item.permission &&
      !hasPermission(
        user,
        item.permission.module,
        item.permission.action || PERMISSION_ACTION.READ
      )
    ) {
      return null
    }

    if ('items' in item && item.items) {
      const items = item.items.filter((child) => {
        if (!child.permission) return true
        return hasPermission(
          user,
          child.permission.module,
          child.permission.action || PERMISSION_ACTION.READ
        )
      })
      return items.length > 0 ? { ...item, items } : null
    }

    return item
  }

  const navGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map(filterNavItem)
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name || 'Raisoni User',
            email: user?.email || '',
            avatar: '',
            userTypeLabel: user
              ? USER_TYPE_LABEL[user.userType] || user.userTypeLabel
              : undefined,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
