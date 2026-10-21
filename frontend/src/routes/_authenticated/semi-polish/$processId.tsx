import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasPermission } from '@/constants/permissions'
import { SemiPolishDetailPage } from '@/features/semi-polish'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/semi-polish/$processId')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: SemiPolishDetailRoute,
})

function SemiPolishDetailRoute() {
  const { processId } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <SemiPolishDetailPage
      processId={processId}
      onBack={() => void navigate({ to: '/semi-polish' })}
    />
  )
}
