'use client';

import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import DashboardContent from './components/dashboard-content';

/**
 * An OSS tenant's home. A SaaS tenant's home is Mingo's, with the same sections, so
 * there this forwards to it, query and fragment kept (old links land here).
 */
export default function Dashboard() {
  const mingoHome = isSaasTenantMode();
  useAppModeRedirect(mingoHome ? routes.mingo.home : null, { carryLocation: true });

  if (mingoHome) return null;
  return <DashboardContent />;
}
