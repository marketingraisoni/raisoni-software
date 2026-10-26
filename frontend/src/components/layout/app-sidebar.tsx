import { useAuthStore } from '@/stores/auth-store'
import { USER_TYPE_LABEL } from '@/constants/user-types'
import { useLayout } from '@/context/layout-provider'
import { useSocket } from '@/context/socket-context'
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
import { canAccessNavigationItem } from './navigation-permissions'
import type { NavItem } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user = useAuthStore((state) => state.auth.user)
  const { unreadChatCount } = useSocket()
  const filterNavItem = (item: NavItem): NavItem | null => {
    if (!canAccessNavigationItem(user, item)) return null

    if ('items' in item && item.items) {
      const items = item.items.filter((child) =>
        canAccessNavigationItem(user, child)
      )
      return items.length > 0 ? { ...item, items } : null
    }

    return item
  }

  const navGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map(filterNavItem)
        .filter((item): item is NavItem => item !== null)
        .map((item) => {
          if (item.url === '/chats') {
            return {
              ...item,
              badge:
                unreadChatCount > 0
                  ? unreadChatCount > 99
                    ? '99+'
                    : String(unreadChatCount)
                  : undefined,
            }
          }
          return item
        }),
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
            avatar: user?.avatarUrl || '',
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
