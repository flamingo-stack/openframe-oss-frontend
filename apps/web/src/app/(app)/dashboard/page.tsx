'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useShellRedirect, useShellVariant } from '@/app/hooks/use-shell-variant';
import { routes } from '@/lib/routes';
import DashboardContent from './components/dashboard-content';

/**
 * The classic shell's home. The Mingo-first shell's home is Mingo's, so there this
 * forwards to it, query and fragment kept (`/` and old links land here). Until the
 * variant answers it shows neither: rendering the dashboard first would flash it, and
 * start its queries, for every Mingo-first user.
 */
export default function Dashboard() {
  const variant = useShellVariant();
  useShellRedirect(variant === 'mingo' ? routes.mingo.home : null, { carryLocation: true });

  if (variant !== 'classic') return <CompactPageLoader />;
  return <DashboardContent />;
}
