import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishPlanningReturnPage } from '@/features/semi-polish'

export const Route = createFileRoute(
  '/_authenticated/semi-polish/planning-returns/$processId'
)({
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
