import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishReadyForIssuePage } from '@/features/semi-polish'

export const Route = createFileRoute(
  '/_authenticated/semi-polish/ready-for-issue'
)({
  component: SemiPolishReadyForIssueRoute,
})

function SemiPolishReadyForIssueRoute() {
  return <SemiPolishReadyForIssuePage />
}
