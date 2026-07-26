'use client';

import { InitialSetupBar } from './initial-setup-bar';
import { OnboardingTourBar } from './onboarding-tour-bar';

/**
 * Which onboarding banner the app layout last rendered in its `topBar` slot,
 * cached so both the shell skeleton AND the live layout can reserve the same
 * band before backend progress arrives.
 *
 * The bar is driven by `OnboardingProgressHydrator` → `onboarding-store`, which
 * resolves well after the shell paints. Because the slot sits ABOVE the sidebar
 * + header, the banner appearing pushes the ENTIRE app down — measured as
 * `<main>` jumping from y=100 to y=56 and back.
 *
 * Both renderers must replay the cache, not just the skeleton: the gap moves to
 * whichever side still renders nothing. A cold profile shows no bar until
 * progress arrives — unavoidable, we genuinely don't know yet.
 *
 * Same approach as the tickets board-column cache and the feature-flag
 * snapshot: persist a layout decision so the pre-data render matches the
 * post-data one.
 */

/** `none` is a real, cacheable answer: onboarding finished ⇒ never reserve the band. */
export type OnboardingTopBarKind = 'initial-setup' | 'tour' | 'none';

export interface CachedOnboardingTopBar {
  kind: OnboardingTopBarKind;
  /** Drives the CTA copy ("Start Setup" vs "Continue Setup"), which sets its width. */
  started: boolean;
}

const STORAGE_KEY = 'openframe:onboarding-top-bar-v1';
const KINDS: readonly OnboardingTopBarKind[] = ['initial-setup', 'tour', 'none'];

export function readCachedOnboardingTopBar(): CachedOnboardingTopBar | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Written by us, but a stale/hand-edited entry must not render a bogus band.
    if (!parsed || !KINDS.includes(parsed.kind)) return null;
    return { kind: parsed.kind, started: !!parsed.started };
  } catch {
    return null;
  }
}

export function writeCachedOnboardingTopBar(next: CachedOnboardingTopBar): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(next);
    if (window.localStorage.getItem(STORAGE_KEY) === serialized) return;
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Private mode / quota — no band is reserved; the bar drops in as before.
  }
}

interface CachedOnboardingTopBarProps {
  cached: CachedOnboardingTopBar | null;
  pathname: string | null;
  /** Real navigation from the live layout; a no-op from the skeleton. */
  onStart: () => void;
}

/**
 * Renders the cached banner. Shared by the skeleton and the live layout so the
 * two can't drift — `showAction` follows the same page rules as the loaded
 * chrome because it changes the bar's height on mobile.
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
