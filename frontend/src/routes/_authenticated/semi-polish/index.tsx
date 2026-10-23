import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishFeature } from '@/features/semi-polish'

export const Route = createFileRoute('/_authenticated/semi-polish/')({
  component: SemiPolishPage,
})

function SemiPolishPage() {
  return <SemiPolishFeature />
}
