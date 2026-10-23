import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishReportPage } from '@/features/semi-polish'

export const Route = createFileRoute('/_authenticated/semi-polish/report')({
  component: SemiPolishReportRoute,
})

function SemiPolishReportRoute() {
  return <SemiPolishReportPage />
}
