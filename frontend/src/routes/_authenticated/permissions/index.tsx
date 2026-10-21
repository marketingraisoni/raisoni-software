import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasPermission } from '@/constants/permissions'
import { Permissions } from '@/features/permissions'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/permissions/')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'users', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: Permissions,
})
