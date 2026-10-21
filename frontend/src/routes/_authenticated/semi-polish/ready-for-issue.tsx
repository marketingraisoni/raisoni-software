import { createFileRoute, redirect } from '@tanstack/react-router';
import { hasPermission } from '@/constants/permissions';
import { SemiPolishReadyForIssuePage } from '@/features/semi-polish';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute(
  '/_authenticated/semi-polish/ready-for-issue'
)({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' });
    }
  },
  component: SemiPolishReadyForIssueRoute,
});

function SemiPolishReadyForIssueRoute() {
  return <SemiPolishReadyForIssuePage />;
}
