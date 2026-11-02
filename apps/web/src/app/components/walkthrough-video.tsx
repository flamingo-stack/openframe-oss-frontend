'use client';

/**
 * App-shell mount of the lib's `<FloatingWalkthroughVideo>` — the same floating
 * demo-video widget every other Flamingo platform ships (multi-platform-hub
 * mounts it in its root layout; see `react-embedding-example` for the reference
 * embed). All UI lives in the core lib; this host only supplies the data and
 * the app-specific placement.
 *
 * Data comes from {@link useWalkthroughVideoData}, shared with the inline mount
 * in the onboarding "Book a call" promo.
 *
 * Mounted ONCE in the app shell, never per page — and it steps aside entirely
 * while a page renders the clip inline (see {@link useHasInlineWalkthrough}),
 * so the same video is never offered twice at once.
 */

import { FloatingWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWalkthroughVideoData, WALKTHROUGH_DISMISS_STORAGE_KEY } from '@/app/hooks/use-walkthrough-video-data';
import { useHasInlineWalkthrough } from '@/lib/inline-walkthrough-signal';
import {
  SIDEBAR_ELEMENT_SELECTOR,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_LIVE_WIDTH_CSS_VAR,
} from '@/lib/navigation-sidebar-state';

/**
 * LEFT-side only. The lib pins the collapsed card into a bottom corner, which
 * on a marketing site is empty space but on the left here sits on top of the
 * navigation sidebar — specifically its bottom-pinned secondary items
 * (Knowledge Base / Help Center / Settings). This margin shifts the card clear
 * of it, tracking the sidebar's ACTUAL width via `useSidebarWidthVar` below:
 * 224px expanded, 56px collapsed, 0 on mobile where the burger menu replaces
 * the sidebar entirely — and it animates along with the sidebar's own 300ms
 * width transition instead of snapping.
 *
 * The `0px` fallback only applies before the first measurement, which lands
 * long before the card's 3s appear delay elapses.
 *
 * The right corner needs no clearance: nothing is pinned there, and the panels
 * that open on that side simply layer over the card.
 */
// The var name is spelled out instead of interpolated from
// SIDEBAR_LIVE_WIDTH_CSS_VAR: Tailwind extracts class names by scanning source
// text, so a template literal produces no rule at all — the build stays green
// and the margin silently never exists.
const SIDEBAR_CLEARANCE = 'ml-[var(--of-sidebar-live-width,0px)] transition-[margin] duration-300';

/**
 * The Mingo-first shell's composer dock (AppShell wraps it in this attribute). The card
 * is pinned to the bottom of the window and the dock sits at the bottom of the page
 * column, so the card would cover the composer, its input included — what the classic
 * shell's drawer once fixed by layering over it. The card rises by the dock's height
 * instead, followed live (the composer grows with a longer draft or an attachment).
 */
const COMPOSER_DOCK_ATTRIBUTE = 'data-composer-dock';
const COMPOSER_DOCK_HEIGHT_CSS_VAR = '--of-composer-dock-live-height';
// Spelled out for Tailwind, as SIDEBAR_CLEARANCE is.
const COMPOSER_DOCK_CLEARANCE = 'mb-[var(--of-composer-dock-live-height,0px)]';

/**
 * Styling hook for the "hide me while a modal is open" rule in
 * `app/globals.css` (which is where the reasoning lives). Needed because the
 * lib pins the card's wrapper at `z-[9980]`, above every hand-rolled overlay
 * tier in the lib (`ModalV2` 1300, burger menu 101, `AlertDialog` 50) — and
 * that wrapper takes no className, so the app cannot re-rank it. The class
 * lands on the card itself; the wrapper it leaves behind is transparent and
 * `pointer-events-none`.
 */
const MODAL_SUPPRESSION_HOOK = 'of-walkthrough-card';

/**
 * Mirror the live sidebar width into a CSS variable for the margin above, on
 * `scope` — the card's own wrapper.
 *
 * A ResizeObserver on the sidebar element, rather than reading its collapse
 * state: the state is module-internal to the core `NavigationSidebar`, and the
 * one signal that does leak out (its `localStorage` key) fires no in-tab event.
 * Observing the box also handles, for free, every case a state read would have
 * to special-case — the tablet overlay, the mobile `display:none`, a window
 * resize crossing a breakpoint, and the width transition itself.
 */
function useSidebarWidthVar(scope: HTMLElement | null, enabled: boolean): void {
  useEffect(() => {
    if (!scope) return undefined;
    const write = (px: number) => scope.style.setProperty(SIDEBAR_LIVE_WIDTH_CSS_VAR, `${px}px`);

    if (!enabled) {
      write(0);
      return undefined;
    }

    const sidebar = document.querySelector(SIDEBAR_ELEMENT_SELECTOR);
    if (!sidebar) {
      // Degrade to the old fixed clearance rather than to zero: a missing
      // element must never resolve to "card sits on top of the navigation".
      write(SIDEBAR_EXPANDED_WIDTH);
      return undefined;
    }

    // `getBoundingClientRect` (not `contentRect`) so the 1px right border is
    // included — the card should clear the border, not land on it.
    const measure = () => write(sidebar.getBoundingClientRect().width);
    measure();

    // No ResizeObserver (very old browsers): the one-shot measurement above
    // still stands, it just won't follow a toggle. Cleanup stays shared so the
    // variable is dropped either way.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(sidebar);
    return () => {
      ro?.disconnect();
      scope.style.removeProperty(SIDEBAR_LIVE_WIDTH_CSS_VAR);
    };
  }, [scope, enabled]);
}

/**
 * Mirror the composer dock's height into a CSS variable for the margin above, on
 * `scope`; 0 where there is no dock (an OSS tenant, a locked workspace). Re-queried
 * on navigation: the dock is held back on some routes.
 */
function useComposerDockHeightVar(scope: HTMLElement | null, pathname: string | null): void {
  useEffect(() => {
    if (!scope) return undefined;
    const write = (px: number) => scope.style.setProperty(COMPOSER_DOCK_HEIGHT_CSS_VAR, `${px}px`);
    const dock = document.querySelector(`[${COMPOSER_DOCK_ATTRIBUTE}]`);
    if (!dock) {
      write(0);
      return () => scope.style.removeProperty(COMPOSER_DOCK_HEIGHT_CSS_VAR);
    }
    const measure = () => write(dock.getBoundingClientRect().height);
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(dock);
    return () => {
      ro?.disconnect();
      scope.style.removeProperty(COMPOSER_DOCK_HEIGHT_CSS_VAR);
    };
  }, [scope, pathname]);
}

export function WalkthroughVideo() {
  const pathname = usePathname();
  const { video } = useWalkthroughVideoData();
  // A page rendering the video inline owns it for as long as it is mounted.
  const inlineElsewhere = useHasInlineWalkthrough();
  // Where the clearance variables live: a `display: contents` box around the card,
  // their only reader. On `<html>` every write restyled the whole document in WebKit
  // (30-110 ms on a large page) — each new line of a draft resizes the dock, and
  // every navigation removed and re-set the dock's.
  const [scope, setScope] = useState<HTMLDivElement | null>(null);

  // No "hide while a panel is open" handling on purpose: a panel that opens on
  // the right is layered OVER the card.
  //
  // The corner is content-managed; mirrored here only for sidebar clearance.
  const side = video?.position ?? 'left';
  // Only while a left-hand card is actually on screen — nothing to clear on the
  // right, before the video lands, or once an inline mount has taken over.
  useSidebarWidthVar(scope, side === 'left' && video !== null && !inlineElsewhere);
  useComposerDockHeightVar(scope, pathname);

  if (inlineElsewhere) {
    return null;
  }

  return (
    <div ref={setScope} className="contents">
      <FloatingWalkthroughVideo
        video={video}
        // The lib can't observe navigation; feeding it the route re-queries the
        // hide target after a soft nav.
        pathname={pathname ?? undefined}
        dismissal={{ storageKey: WALKTHROUGH_DISMISS_STORAGE_KEY }}
        className={cn(MODAL_SUPPRESSION_HOOK, COMPOSER_DOCK_CLEARANCE, side === 'left' && SIDEBAR_CLEARANCE)}
      />
    </div>
  );
}
