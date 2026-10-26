import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishActivePage } from '@/features/semi-polish/active-page'

export const Route = createFileRoute('/_authenticated/semi-polish/')({
  component: SemiPolishPage,
})

function SemiPolishPage() {
  return <SemiPolishActivePage />
}
