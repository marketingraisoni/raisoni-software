import { createFileRoute, redirect } from '@tanstack/react-router'
import { Settings } from '@/features/settings'
import { hasPermission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/settings')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'settings', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: Settings,
})
