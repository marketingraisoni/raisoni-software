import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Navigate,
  Outlet,
} from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Toaster } from '@/components/ui/sonner'
import { getFirstAccessibleNavigationRoute } from '@/components/layout/navigation-permissions'
import { NavigationProgress } from '@/components/navigation-progress'
import { GeneralError } from '@/features/errors/general-error'

function NotFoundRedirect() {
  const user = useAuthStore((state) => state.auth.user)
  return <Navigate to={getFirstAccessibleNavigationRoute(user)} replace />
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <Toaster duration={5000} />
      </>
    )
  },
  notFoundComponent: NotFoundRedirect,
  errorComponent: GeneralError,
})
