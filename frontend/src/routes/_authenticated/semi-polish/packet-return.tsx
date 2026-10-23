import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/semi-polish/packet-return'
)({
  beforeLoad: () => {
    throw redirect({ to: '/semi-polish/packet-scanner' })
  },
})

