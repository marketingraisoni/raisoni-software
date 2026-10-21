import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasPermission } from '@/constants/permissions'
import { AssortmentLots } from '@/features/assortment'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/packets/')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: PacketsPage,
})

function PacketsPage() {
  const navigate = Route.useNavigate()

  return (
    <AssortmentLots
      onAssort={(lotId) => void navigate({ to: '/packets/$lotId', params: { lotId } })}
    />
  )
}
