import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishPlanningReturnPage } from '@/features/semi-polish/planning-return-page'

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
