import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasPermission } from '@/constants/permissions'
import { Lots } from '@/features/lots'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/lots/')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: Lots,
})
