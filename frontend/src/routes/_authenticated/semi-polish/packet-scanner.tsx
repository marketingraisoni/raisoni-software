import { createFileRoute } from '@tanstack/react-router'
import { SemiPolishPacketReturnScannerPage } from '@/features/semi-polish/packet-return-scanner-page'

export const Route = createFileRoute(
  '/_authenticated/semi-polish/packet-scanner'
)({
  component: SemiPolishPacketReturnScannerPage,
})
