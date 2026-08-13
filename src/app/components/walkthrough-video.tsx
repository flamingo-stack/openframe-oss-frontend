'use client';

/**
 * App-shell mount of the lib's `<FloatingWalkthroughVideo>` — the same floating
 * demo-video widget every other Flamingo platform ships (multi-platform-hub
 * mounts it in its root layout; see `react-embedding-example` for the reference
 * embed). All UI lives in the core lib; this host only supplies the data and
 * the app-specific placement.
 *
 * Data is fetched HERE rather than through the lib's `useWalkthroughVideo`
 * hook, for exactly one reason: that hook calls a bare `fetch`. The route is
 * public on the hub, but we reach it through the tenant gateway's `/content`
 * proxy, which the gateway role-gates (`/content/**` → `hasAnyRole(AGENT,
 * ADMIN)`). A bare `fetch` only ever carries a session cookie — so it 401s in
 * dev-ticket mode (bearer auth, no cookie) and in the native shell (absolute
 * cross-origin URL). `embedAuthedFetch` is what every other embeddable
 * `/content` surface in this app uses: it attaches the bearer in bearer mode,
 * sends `credentials: 'include'`, sanctions the native shell's gateway origin,
 * and refresh-retries a 401 — all off the SAME `EmbedAuthAdapter` the chat
 * registers at module load in `openframe-chat-runtime-provider`. Precedent:
 * `useRelease` in `help-center/releases/detail/release-detail-client.tsx`.
 *
 * Feeding `video` in directly is the lib's supported host path (it's what the
 * hub's SSR mount does); only client-only embedders with no auth to attach need
 * the hook.
 *
 * The widget is deliberately mounted ONCE in the app shell (next to the Mingo
 * chat drawer), never per page.
 */

import {
  FloatingWalkthroughVideo,
  type WalkthroughVideoData,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { embedAuthedFetch, walkthroughDismissCookieName } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CONTENT_BASE, EP } from '@/app/(app)/help-center/endpoints';
import { getCurrentPlatform } from '@/lib/app-config';
import {
  SIDEBAR_ELEMENT_SELECTOR,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_LIVE_WIDTH_CSS_VAR,
} from '@/lib/navigation-sidebar-state';

/** Per-platform dismissal cookie, same naming the hub uses. */
const DISMISS_STORAGE_KEY = walkthroughDismissCookieName(getCurrentPlatform());

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
      return;
    }

    const sidebar = document.querySelector(SIDEBAR_ELEMENT_SELECTOR);
    if (!sidebar) {
      // Degrade to the old fixed clearance rather than to zero: a missing
      // element must never resolve to "card sits on top of the navigation".
      write(SIDEBAR_EXPANDED_WIDTH);
      return;
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

/**
 * Host-supplied read of the per-platform walkthrough video. Mirrors the lib
 * hook's contract: the endpoint takes no platform param (the hub resolves it
 * server-side) and answers the RAW body `{ walkthroughVideo }` — `null` when
 * that platform has none. A real HTTP failure THROWS so React Query retries
 * instead of caching a fake "no video"; the 404 arm mirrors the lib's, for
 * proxies that 404 a missing resource.
 */
function useWalkthroughVideoData(): WalkthroughVideoData | null {
  const query = useQuery<WalkthroughVideoData | null>({
    queryKey: ['walkthrough-video', EP.walkthroughVideo],
    // Matches the lib hook's window — the widget is mounted for the whole
    // session, so this only governs refetch-on-remount after a hard nav.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await embedAuthedFetch(EP.walkthroughVideo);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Walkthrough video request failed (${res.status})`);
      const body = (await res.json()) as { walkthroughVideo: WalkthroughVideoData | null };
      const video = body?.walkthroughVideo ?? null;
      // `captionsUrl` arrives as a RELATIVE hub path (`/api/captions/…`), which
      // would otherwise resolve against this app's origin — re-prefix it onto
      // the same `/content` proxy. Done in `queryFn`, not a `select`: the lib
      // hook needs `select` to keep the shared cache clean for other observers,
      // but we're the only consumer, and rewriting here keeps the cached object
      // IDENTITY-STABLE across renders. That matters — a fresh `video` object
      // restarts the widget's appear-delay timer on every app-shell re-render.
      if (video?.captionsUrl?.startsWith('/')) {
        return { ...video, captionsUrl: `${CONTENT_BASE}${video.captionsUrl}` };
      }
      return video;
    },
  });

  return query.data ?? null;
}

export function WalkthroughVideo() {
  const pathname = usePathname();
  const video = useWalkthroughVideoData();

  // No "hide while a panel is open" handling here on purpose: an open side
  // panel is layered OVER the card instead (see WALKTHROUGH_OVERLAP_Z in
  // `app-layout.tsx`), so the card needs no knowledge of the panels at all.
  //
  // The corner is content-managed (hub admin → the video's `position`); the lib
  // resolves it the same way, we mirror it only to decide on sidebar clearance.
  const side = video?.position ?? 'left';
  // Measure only while a left-hand card is actually on screen — there is no
  // sidebar to clear on the right, and none to measure before the video lands.
  useSidebarWidthVar(side === 'left' && video !== null);

  return (
    <FloatingWalkthroughVideo
      video={video}
      // The lib can't observe navigation; feeding it the route re-queries the
      // hide target after a soft nav.
      pathname={pathname ?? undefined}
      dismissal={{ storageKey: DISMISS_STORAGE_KEY }}
      className={side === 'left' ? SIDEBAR_CLEARANCE : undefined}
    />
  );
}
