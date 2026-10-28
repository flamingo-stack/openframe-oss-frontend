'use client';

import { MingoDashboard } from '@/app/(app)/mingo/home/mingo-dashboard';
import { isSaasTenantMode } from '@/lib/app-mode';
import DashboardContent from './components/dashboard-content';

/** Where a login lands: an OSS tenant's dashboard, or the Mingo-first shell's on a SaaS tenant. */
export default function Dashboard() {
  if (isSaasTenantMode()) return <MingoDashboard />;
  return <DashboardContent />;
}
