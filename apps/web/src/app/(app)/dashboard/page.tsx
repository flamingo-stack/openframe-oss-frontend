'use client';

import { MingoDashboard } from '@/app/(app)/mingo/home/mingo-dashboard';
import { isSaasTenantMode } from '@/lib/app-mode';
import DashboardContent from './components/dashboard-content';

/**
 * An OSS tenant's dashboard, where its login lands; on a SaaS tenant the Mingo-first shell's
 * (the sidebar's Dashboard: a SaaS login lands on Mingo's home, `getLandingPath`).
 */
export default function Dashboard() {
  if (isSaasTenantMode()) return <MingoDashboard />;
  return <DashboardContent />;
}
