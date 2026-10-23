import { createFileRoute } from '@tanstack/react-router'
import { AssortmentLots } from '@/features/assortment'

export const Route = createFileRoute('/_authenticated/packets/')({
  component: PacketsPage,
})

function PacketsPage() {
  const navigate = Route.useNavigate()

  return (
    <AssortmentLots
      onAssort={(lotId) =>
        void navigate({ to: '/packets/$lotId', params: { lotId } })
      }
    />
  )
}
