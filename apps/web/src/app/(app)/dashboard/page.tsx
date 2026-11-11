'use client';

import { MingoDashboard } from '@/app/(app)/mingo/home/mingo-dashboard';
import { useManhattanDock } from '@/app/components/manhattan-shell/manhattan-dock-context';
import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import DashboardContent from './components/dashboard-content';

/**
 * An OSS tenant's dashboard, where its login lands; on a SaaS tenant the Mingo-first shell's
 * (the sidebar's Dashboard: a SaaS login lands on Mingo's home, `getLandingPath`). The
 * Manhattan v2 shell has no dashboard (plan D15): its "Needs you" is on Start Work, where it leads.
 */
export default function Dashboard() {
  const manhattan = useManhattanDock();
  useAppModeRedirect(manhattan ? routes.mingo.home : null);
  if (manhattan) return null;
  if (isSaasTenantMode()) return <MingoDashboard />;
  return <DashboardContent />;
}
