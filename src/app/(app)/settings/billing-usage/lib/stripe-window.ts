'use client';

/**
 * Everything Stripe hosts — checkout, the customer portal, a hosted invoice —
 * opens in its own tab, so the app is still there when the user comes back.
 *
 * Navigating this tab instead loses whatever was on screen: a paywall
 * mid-selection, a billing page mid-read. Stripe's own flows end on a return
 * URL, but an abandoned one ends nowhere, and the back button lands on a
 * re-issued session.
 */

/** A tab already opened, waiting for the URL it will show. */
export interface DeferredTab {
  /** Point the tab at `url`, or navigate this one if it could not be opened. */
  navigate: (url: string) => void;
  /** The URL never arrived — close the blank tab rather than leave it open. */
  cancel: () => void;
}

/**
 * Open a tab NOW for a URL that does not exist yet.
 *
 * Stripe mints checkout and portal URLs per click, through a mutation, so by the
 * time one arrives the click is over and `window.open` counts as a popup —
 * which browsers block. Opening while the user gesture is still live keeps the
 * tab; the URL is pushed into it when the response lands.
 *
 * `noopener` is NOT passed, deliberately: with it browsers return no handle at
 * all, and the handle is the entire point here. The link back is severed on the
 * opened tab instead, which is the same guarantee.
 */
export function openDeferredTab(): DeferredTab {
  const target = typeof window === 'undefined' ? null : window.open('', '_blank');
  if (target) target.opener = null;

  return {
    navigate: url => {
      // No handle means the popup was blocked anyway. Being sent to Stripe in
      // this tab is worse than in a new one, and far better than a button that
      // silently does nothing.
      if (target) target.location.href = url;
      else window.location.href = url;
    },
    cancel: () => target?.close(),
  };
}

/** Open a URL that is already known — a hosted invoice, from its own click. */
export function openExternalTab(url: string): void {
  const target = window.open(url, '_blank', 'noopener,noreferrer');
  if (!target) window.location.href = url;
}
