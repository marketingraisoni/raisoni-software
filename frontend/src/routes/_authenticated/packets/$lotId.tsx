import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasPermission } from '@/constants/permissions'
import { AssortmentDetail } from '@/features/assortment/detail'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/packets/$lotId')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: PacketDetailPage,
})

function PacketDetailPage() {
  const { lotId } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <AssortmentDetail
      lotId={lotId}
      onBack={() => void navigate({ to: '/packets' })}
    />
  )
}
