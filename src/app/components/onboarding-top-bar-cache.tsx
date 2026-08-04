'use client';

import { useEffect, useState } from 'react';
import {
  type CachedOnboardingTopBar as CachedTopBar,
  readCachedOnboardingTopBar,
} from '@/lib/onboarding-top-bar-cache';
import { InitialSetupBar } from './initial-setup-bar';
import { OnboardingTourBar } from './onboarding-tour-bar';

/**
 * React side of the onboarding banner cache — the storage layer (and the reason
 * it is split out) lives in `@/lib/onboarding-top-bar-cache`.
 *
 * Which onboarding banner the app layout last rendered in its `topBar` slot,
 * cached so the layout can reserve the same band before backend progress
 * arrives.
 *
 * The bar is driven by `OnboardingProgressHydrator` → `onboarding-store`, which
 * resolves well after the shell paints. Because the slot sits ABOVE the sidebar
 * + header, the banner appearing pushes the ENTIRE app down — measured as
 * `<main>` jumping from y=100 to y=56 and back.
 *
 * A cold profile shows no bar until progress arrives — unavoidable, we genuinely
 * don't know yet. So does a shell with no session behind it: the replay is
 * scoped to a signed-in owner (`ownerId`), because the hydrator never runs
 * without a session and the `else` branch that renders this would otherwise hold
 * a dead session's banner over the skeleton indefinitely.
 *
 * Same approach as the tickets board-column cache and the feature-flag
 * snapshot: persist a layout decision so the pre-data render matches the
 * post-data one.
 */

/**
 * Set once any instance has mounted, so a later mount reads the cache in its
 * initializer rather than a render later.
 */
let hasHydrated = false;

function isSameCachedBar(a: CachedTopBar | null, b: CachedTopBar | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.started === b.started && a.userId === b.userId;
}

/**
 * Hydration-safe, owner-scoped `readCachedOnboardingTopBar` — use this from a render.
 *
 * `ownerId` is the user the replay is allowed to speak for: the caller passes
 * `null` whenever there is no session that could own the band (see `AppShell`),
 * and this then reserves nothing.
 *
 * The read is `localStorage`, so it returns `null` during a server render and the
 * cached bar in the browser. Consumed straight from a `useState` initializer (as
 * the shell layout used to), that makes the server and the first client render
 * disagree about whether the band exists at all — a hydration mismatch, which
 * costs the whole shell subtree being discarded and re-rendered. Since this bar
 * sits in the app shell, that applied to every page.
 *
 * First render returns `null` on both sides; the cached value lands right after
 * mount. The band still gets reserved before the onboarding query answers, which
 * is what the cache is for — just one frame later than before. The effect re-runs
 * when the owner changes (sign-in resolving, sign-out) so the band follows it.
 */
export function useCachedOnboardingTopBar(ownerId: string | null): CachedTopBar | null {
  const [cached, setCached] = useState<CachedTopBar | null>(() =>
    hasHydrated ? readCachedOnboardingTopBar(ownerId) : null,
  );

  useEffect(() => {
    hasHydrated = true;
    const next = readCachedOnboardingTopBar(ownerId);
    // Value-compare so a remount (whose initializer already read the same entry)
    // stays a no-op React bails out of, while a real owner change re-renders.
    setCached(prev => (isSameCachedBar(prev, next) ? prev : next));
  }, [ownerId]);

  return cached;
}

interface CachedOnboardingTopBarProps {
  cached: CachedTopBar | null;
  pathname: string | null;
  /** Real navigation from the live layout. */
  onStart: () => void;
}

/**
 * Renders the cached banner. `showAction` follows the same page rules as the
 * loaded chrome because it changes the bar's height on mobile.
 */
export function CachedOnboardingTopBar({ cached, pathname, onStart }: CachedOnboardingTopBarProps) {
  if (!cached || cached.kind === 'none') return null;

  const isDashboardPage = pathname === '/' || (pathname?.startsWith('/dashboard') ?? false);
  const isOnboardingPage = pathname?.startsWith('/onboarding') ?? false;

  return cached.kind === 'initial-setup' ? (
    <InitialSetupBar onStart={onStart} started={cached.started} showAction={!isDashboardPage} />
  ) : (
    <OnboardingTourBar onStart={onStart} started={cached.started} showAction={!isOnboardingPage} />
  );
}
