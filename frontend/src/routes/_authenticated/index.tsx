import { createFileRoute, redirect } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'
import { hasPermission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'dashboard', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: Dashboard,
})
