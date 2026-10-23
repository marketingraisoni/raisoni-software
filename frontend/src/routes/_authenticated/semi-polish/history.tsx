import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishHistoryPage } from '@/features/semi-polish'

export const Route = createFileRoute('/_authenticated/semi-polish/history')({
  component: SemiPolishHistoryRoute,
})

function SemiPolishHistoryRoute() {
  return <SemiPolishHistoryPage />
}
