import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/constants/permissions'
import { SemiPolishPacketReturnScannerPage } from '@/features/semi-polish'

export const Route = createFileRoute(
  '/_authenticated/semi-polish/packet-scanner'
)({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' })
    }
  },
  component: SemiPolishPacketReturnScannerPage,
})
