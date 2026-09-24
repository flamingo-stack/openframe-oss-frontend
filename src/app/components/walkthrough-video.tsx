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
import { useEffect } from 'react';
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
 * that open on that side simply layer over the card (see WALKTHROUGH_OVERLAP_Z
 * in `app-layout.tsx`).
 */
// The var name is spelled out instead of interpolated from
// SIDEBAR_LIVE_WIDTH_CSS_VAR: Tailwind extracts class names by scanning source
// text, so a template literal produces no rule at all — the build stays green
// and the margin silently never exists.
const SIDEBAR_CLEARANCE = 'ml-[var(--of-sidebar-live-width,0px)] transition-[margin] duration-300';

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
 * Mirror the live sidebar width into a CSS variable for the margin above.
 *
 * A ResizeObserver on the sidebar element, rather than reading its collapse
 * state: the state is module-internal to the core `NavigationSidebar`, and the
 * one signal that does leak out (its `localStorage` key) fires no in-tab event.
 * Observing the box also handles, for free, every case a state read would have
 * to special-case — the tablet overlay, the mobile `display:none`, a window
 * resize crossing a breakpoint, and the width transition itself.
 */
function useSidebarWidthVar(enabled: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    const write = (px: number) => root.style.setProperty(SIDEBAR_LIVE_WIDTH_CSS_VAR, `${px}px`);

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
      root.style.removeProperty(SIDEBAR_LIVE_WIDTH_CSS_VAR);
    };
  }, [enabled]);
}

export function WalkthroughVideo() {
  const pathname = usePathname();
  const { video } = useWalkthroughVideoData();
  // A page rendering the video inline owns it for as long as it is mounted.
  const inlineElsewhere = useHasInlineWalkthrough();

  // No "hide while a panel is open" handling on purpose: an open side panel is
  // layered OVER the card (see WALKTHROUGH_OVERLAP_Z in `app-layout.tsx`).
  //
  // The corner is content-managed; mirrored here only for sidebar clearance.
  const side = video?.position ?? 'left';
  // Only while a left-hand card is actually on screen — nothing to clear on the
  // right, before the video lands, or once an inline mount has taken over.
  useSidebarWidthVar(side === 'left' && video !== null && !inlineElsewhere);

  if (inlineElsewhere) {
    return null;
  }

  return (
    <FloatingWalkthroughVideo
      video={video}
      // The lib can't observe navigation; feeding it the route re-queries the
      // hide target after a soft nav.
      pathname={pathname ?? undefined}
      dismissal={{ storageKey: WALKTHROUGH_DISMISS_STORAGE_KEY }}
      className={cn(MODAL_SUPPRESSION_HOOK, side === 'left' && SIDEBAR_CLEARANCE)}
    />
  );
}
