import { createFileRoute, redirect } from '@tanstack/react-router';
import { hasPermission } from '@/constants/permissions';
import { SemiPolishReportPage } from '@/features/semi-polish';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/_authenticated/semi-polish/report')({
  beforeLoad: () => {
    if (!hasPermission(useAuthStore.getState().auth.user, 'lots', 'read')) {
      throw redirect({ to: '/403' });
    }
  },
  component: SemiPolishReportRoute,
});

function SemiPolishReportRoute() {
  return <SemiPolishReportPage />;
}
