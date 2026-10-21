import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/constants/permissions'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { USER_TYPE_LABEL } from '@/constants/user-types'
import { sidebarData } from './data/sidebar-data'
import { AppTitle } from './app-title'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user = useAuthStore((state) => state.auth.user)
  const navGroups = sidebarData.navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.title === 'Dashboard') return hasPermission(user, 'dashboard', 'read')
      if (item.title === 'Users') return hasPermission(user, 'users', 'read')
      if (item.title === 'Permissions') return hasPermission(user, 'users', 'read')
      if (item.title === 'Settings') return hasPermission(user, 'settings', 'read')
      return true
    }),
  }))

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
            userTypeLabel: user ? (USER_TYPE_LABEL[user.userType] || user.userTypeLabel) : undefined,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
