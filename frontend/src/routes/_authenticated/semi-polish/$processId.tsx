import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishDetailPage } from '@/features/semi-polish'

export const Route = createFileRoute('/_authenticated/semi-polish/$processId')({
  component: SemiPolishDetailRoute,
})

function SemiPolishDetailRoute() {
  const { processId } = Route.useParams()

  return <SemiPolishDetailPage processId={processId} />
}
