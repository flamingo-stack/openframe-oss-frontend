import type { HeaderLoadingCell } from '@flamingo-stack/openframe-frontend-core/components/navigation';

/**
 * Shell constants the LIVE `AppLayout` needs. The chrome has no separate placeholder
 * copy: its own `loading` props cover that window from inside the real sidebar and
 * header, so nothing here draws a parallel one.
 *
 * Framework-neutral on purpose (no `'use client'`): the (app) group layout, a
 * server-adjacent module, imports it.
 */

/**
 * The trailing header cells the live header reserves while the chrome loads, in the
 * order it renders them: the time tracker, then notifications (an OSS tenant has no
 * Mingo cell). No avatar — the header carries no user cell (`showUser: false`), and
 * reserving one would leave a cell that never fills in.
 */
export function headerLoadingCells(): HeaderLoadingCell[] {
  return ['icon', 'icon'];
}

/**
 * The same for the Mingo-first shell, whose header is the phone top bar only
 * (`desktopHeader: false`): the Chat history cell first (a `start` custom cell,
 * `'icon-max-md'` like every phone-only cell), then the time tracker and
 * notifications. No Mingo launcher: the composer is docked under every page, and
 * Mingo's home is the drawer's "New chat".
 */
export function mingoHeaderLoadingCells(): HeaderLoadingCell[] {
  return ['icon-max-md', 'icon', 'icon'];
}

/**
 * Bottom padding the (app) group layout passes to the live `<main>` for standard
 * routes (its `mainClassNameOverride || …` fallback). Defined here — not in
 * app-layout.tsx — because that file imports this one and the constant must be
 * shared without a cycle.
 */
export const APP_MAIN_CLASS_NAME = 'pb-14';

/**
 * Per-route `<main>` padding overrides. Lives here, beside `APP_MAIN_CLASS_NAME`
 * and for the same reason: the (app) group layout imports this file, so the
 * constants must be shared without a cycle.
 */
export function getMainClassNameOverride(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  if (pathname.startsWith('/devices/details/file-manager')) return 'pb-0 md:pb-0';
  if (pathname.startsWith('/tickets')) return 'pb-0 md:pb-0';
  if (pathname.startsWith('/settings')) return 'pb-0 md:pb-0';
  // The Mingo chat and archive pages fill `<main>` (`h-full`): the default bottom
  // padding would add its height as a scroll under them.
  if (pathname.startsWith('/mingo/chat') || pathname.startsWith('/mingo/archive')) return 'pb-0 md:pb-0';
  return undefined;
}

/**
 * The routes the shell renders BARE - no header, sidebar or Mingo panel: the
 * setup wizard, which the design draws as a full-screen page of its own. A
 * prefix match of the kind ROUTES.md allows for active-state checks; the
 * trailing-slash form is what the static export serves.
 */
export function isBareChromeRoute(pathname: string | null): boolean {
  return pathname === '/setup' || (pathname?.startsWith('/setup/') ?? false);
}

/**
 * Where a login lands - the dashboard, and Mingo's home, which takes its place in
 * the Mingo-first shell (`/dashboard` forwards there). The pages the onboarding
 * redirect moves away from; nothing deeper.
 */
export function isLandingRoute(pathname: string | null): boolean {
  return pathname === '/dashboard' || pathname === '/dashboard/' || pathname === '/mingo' || pathname === '/mingo/';
}

/**
 * Whether the landing page (the dashboard, or Mingo's home) must stay on its
 * skeleton for now: under onboarding v2 it is where a login lands, and whether this session belongs there
 * or on `/setup` is known only once the flag and the onboarding progress have
 * answered (`useSetupPending`). Until then the page would render in full - stat
 * cards, the Mingo composer - and be torn down a moment later by the redirect.
 * Held while the answer is `unknown` AND once it is `setup`, so no frame of the
 * dashboard shows before the wizard; released on `none`, on the flag `off`
 * (the old flow lives on the dashboard itself) and on a locked workspace (the
 * lock screen takes the slot, and the progress request is parked there anyway).
 */
export function holdsDashboard(
  pathname: string | null,
  onboardingV2: 'loading' | 'on' | 'off',
  pending: 'unknown' | 'setup' | 'none',
  locked: boolean,
): boolean {
  return !locked && onboardingV2 !== 'off' && pending !== 'none' && isLandingRoute(pathname);
}
