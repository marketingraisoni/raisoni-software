import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishReadyForIssuePage } from '@/features/semi-polish'

const readyForIssueSearchSchema = z.object({
  lotId: z.string().optional(),
})

export const Route = createFileRoute(
  '/_authenticated/semi-polish/ready-for-issue'
)({
  validateSearch: readyForIssueSearchSchema,
  component: SemiPolishReadyForIssueRoute,
})

function SemiPolishReadyForIssueRoute() {
  const { lotId } = Route.useSearch()
  return <SemiPolishReadyForIssuePage initialLotId={lotId} />
}
