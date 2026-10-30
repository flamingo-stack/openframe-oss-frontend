'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSetupPending } from '@/app/(app)/setup/hooks/use-setup-pending';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { isBareChromeRoute, isLandingRoute } from './app-shell-chrome';

/**
 * Keeps the landing page and the `/setup` wizard on the right side of the
 * onboarding state (flag `onboarding-v2`): a workspace that still owes its
 * Initial Setup, or a user who has not yet started the Mingo tour, lands on
 * `/setup` instead of the landing page (the dashboard, or Mingo's home in the
 * Mingo-first shell), and a session past both leaves `/setup` for it. Only
 * those routes move - a deep link to any other
 * page is honoured, as it was with the Initial Setup card.
 *
 * Renders nothing. Mounted beside the progress hydrator, under the session and
 * subscription gates, so `useSetupPending` reads loaded progress and never
 * answers on a locked workspace.
 */
export function OnboardingV2Redirect() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useSetupPending();

  useEffect(() => {
    if (pending === 'setup' && isLandingRoute(pathname)) {
      router.replace(routes.setup);
    } else if (pending === 'none' && isBareChromeRoute(pathname)) {
      router.replace(isSaasTenantMode() ? routes.mingo.home : routes.dashboard);
    }
  }, [pending, pathname, router]);

  return null;
}
