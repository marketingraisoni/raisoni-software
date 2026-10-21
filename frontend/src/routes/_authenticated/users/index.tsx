import { createFileRoute, redirect } from '@tanstack/react-router'
import { Users } from '@/features/users'
import { hasPermission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/users/')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'users', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: Users,
})

