import { createFileRoute } from '@tanstack/react-router'
import { Lots } from '@/features/lots'

export const Route = createFileRoute('/_authenticated/lots/')({
  component: Lots,
})
