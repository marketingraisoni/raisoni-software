import { createFileRoute } from '@tanstack/react-router'
import { AssortmentDetail } from '@/features/assortment/detail'

export const Route = createFileRoute('/_authenticated/packets/$lotId')({
  component: PacketDetailPage,
})

function PacketDetailPage() {
  const { lotId } = Route.useParams()

  return <AssortmentDetail lotId={lotId} />
}
