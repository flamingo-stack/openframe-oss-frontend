/**
 * Storage layer for the free-trial banner's dismissal.
 *
 * Kept UI-free and in `lib/` for the same reason as the onboarding banner cache
 * beside it: `localStorage` access has to be callable from outside React, and
 * pulling banner components into that graph is the wrong trade.
 *
 * Scoped to a TRIAL, not to a browser. The token the caller passes identifies
 * the trial period (its subscription and when it ends), so dismissing today's
 * warning cannot silence a trial the tenant starts next quarter — and cannot
 * silence a second account signing in to the same tab.
 */

const STORAGE_KEY = 'openframe:trial-bar-dismissed-v1';

/** Was the banner for exactly this trial already dismissed? */
export function isTrialBarDismissed(token: string | null): boolean {
  if (!token || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === token;
  } catch {
    // Private mode, or storage disabled outright. Showing the banner is the
    // safe direction: it is dismissible, so the cost is one click.
    return false;
  }
}

/**
 * Remember that this trial's banner was dismissed. One entry, overwritten —
 * there is only ever one trial to remember, and keeping a history of past ones
 * would only grow.
 */
export function dismissTrialBar(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Nothing to do: the banner reappears next load, which is the failure this
    // is allowed to have.
  }
}
