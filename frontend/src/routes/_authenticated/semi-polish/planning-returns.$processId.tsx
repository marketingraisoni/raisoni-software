import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasPermission } from '@/constants/permissions'
import { SemiPolishPlanningReturnPage } from '@/features/semi-polish'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute(
  '/_authenticated/semi-polish/planning-returns/$processId'
)({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: SemiPolishPlanningReturnRoute,
})

function SemiPolishPlanningReturnRoute() {
  const { processId } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <SemiPolishPlanningReturnPage
      processId={processId}
      onBack={() =>
        void navigate({
          to: '/semi-polish/$processId',
          params: { processId },
        })
      }
      onFinalized={() =>
        void navigate({
          to: '/semi-polish/$processId',
          params: { processId },
          replace: true,
        })
      }
    />
  )
}
