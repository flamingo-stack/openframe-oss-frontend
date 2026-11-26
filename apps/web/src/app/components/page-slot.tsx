'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { type ReactNode, Suspense } from 'react';
import { DashboardOverviews } from '@/app/(app)/dashboard/components/dashboard-content';
import { ManhattanStartWork } from '@/app/(app)/mingo/home/manhattan-start-work';
import { MingoDashboard } from '@/app/(app)/mingo/home/mingo-dashboard';
import { MingoNewChat } from '@/app/(app)/mingo/home/mingo-new-chat';
import { isSaasTenantMode } from '@/lib/app-mode';
import { isLandingRoute } from './app-shell-chrome';
import { composerRouteOf } from './mingo-shell/mingo-dock-route';
import { PageFallbackProvider } from './page-fallback-context';

/**
 * The landing page's skeleton (Mingo's home, the dashboard), `null` on any other route. Mingo's home is a new chat:
 * its greeting, nothing that loads; in Manhattan v2 it is Start Work, its "Needs you" in its loading form.
 */
function landingSkeletonFor(pathname: string | null, manhattan: boolean): ReactNode {
  if (!isLandingRoute(pathname)) return null;
  if (composerRouteOf(pathname) === 'home') return manhattan ? <ManhattanStartWork live={false} /> : <MingoNewChat />;
  return (
    <LoadingFallback label="Loading dashboard">
      {isSaasTenantMode() ? <MingoDashboard live={false} /> : <DashboardOverviews />}
    </LoadingFallback>
  );
}

/**
 * The page segment's boundary: what the chrome, bare or not, puts in its content slot. Every page draws its own
 * loading state (its components in a loading scope, behind its own boundaries), so this one only keeps a read that
 * escapes a page from suspending the chrome around it.
 *
 * On a landing route the slot draws the landing skeleton while the shell holds the page (`held`: the onboarding answer
 * is not in), and keeps drawing it until the page can draw itself: as the boundary's fallback (the page's chunk still
 * loading on a cold cache) and through `PageFallbackProvider` for the device status gate above the page (its probe
 * still out in a new tab). Each drew nothing before, and the centre went empty between the skeleton and the page
 * (CU-17tkuw69uzq). Any other route draws nothing while it waits, as before.
 */
export function PageSlot({
  pathname,
  manhattan,
  held,
  children,
}: {
  pathname: string | null;
  manhattan: boolean;
  held: boolean;
  children: ReactNode;
}) {
  const landingSkeleton = landingSkeletonFor(pathname, manhattan);
  return (
    <PageFallbackProvider value={landingSkeleton}>
      {/* loading-standard-ok(RAW_SUSPENSE): the segment's backstop, not a reader's: a landing route keeps its skeleton, the rest draw nothing */}
      <Suspense fallback={landingSkeleton}>{held ? landingSkeleton : children}</Suspense>
    </PageFallbackProvider>
  );
}
