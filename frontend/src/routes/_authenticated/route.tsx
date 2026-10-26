import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUser } from '@/services/auth-service'
import { useAuthStore } from '@/stores/auth-store'
import { getAuthenticatedRoutePermission } from '@/constants/route-permissions'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { getFirstAccessibleNavigationRoute } from '@/components/layout/navigation-permissions'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    if (!auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    if (!auth.user) {
      try {
        auth.setUser(await getCurrentUser())
      } catch {
        auth.reset()
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
        })
      }
    }

    const permission = getAuthenticatedRoutePermission(location.pathname)
    if (
      permission &&
      !useAuthStore
        .getState()
        .auth.canAccess(permission.module, permission.action)
    ) {
      throw redirect({
        to: getFirstAccessibleNavigationRoute(
          useAuthStore.getState().auth.user
        ),
        replace: true,
      })
    }
  },
  component: AuthenticatedLayout,
})
