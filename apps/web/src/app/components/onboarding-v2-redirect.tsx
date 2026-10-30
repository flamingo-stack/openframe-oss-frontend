'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSetupPending } from '@/app/(app)/setup/hooks/use-setup-pending';
import { routes } from '@/lib/routes';
import { isBareChromeRoute, isDashboardRoute } from './app-shell-chrome';

/**
 * Keeps the dashboard and the `/setup` wizard on the right side of the
 * onboarding state (flag `onboarding-v2`): a workspace that still owes its
 * Initial Setup, or a user who has not yet been through the wizard's last
 * screen, lands on `/setup` instead of the dashboard, and a session past both
 * leaves `/setup` for the dashboard. Only those two routes move - a deep link
 * to any other page is honoured, as it was with the Initial Setup card.
 *
 * The way out of `/setup` is decided once per visit, when the answer first
 * lands. The wizard records its last screen as seen the moment it shows, and
 * that answer, flipping to "nothing pending" mid-visit, must not throw the
 * admin off the screen before "Start with Mingo": from there leaving is the
 * wizard's own job. The way in stays live - "Reset Onboarding" on the
 * dashboard flips the answer back, and the redirect follows it.
 *
 * Renders nothing. Mounted beside the progress hydrator, under the session and
 * subscription gates, so `useSetupPending` reads loaded progress and never
 * answers on a locked workspace.
 */
export function OnboardingV2Redirect() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useSetupPending();
  /** The `/setup` pathname whose visit has had its way out decided. */
  const decidedFor = useRef<string | null>(null);

  useEffect(() => {
    const onWizard = isBareChromeRoute(pathname);
    if (!onWizard) decidedFor.current = null;
    if (pending === 'unknown') return;
    if (pending === 'setup' && isDashboardRoute(pathname)) {
      router.replace(routes.setup);
    } else if (onWizard && decidedFor.current !== pathname) {
      decidedFor.current = pathname;
      if (pending === 'none') router.replace(routes.dashboard);
    }
  }, [pending, pathname, router]);

  return null;
}
