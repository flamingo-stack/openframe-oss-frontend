'use client';

/**
 * Host-owned read of the per-platform walkthrough video — the ONE place this
 * app fetches `/content/api/walkthrough-video`, shared by every surface that
 * renders the video (the app-shell floating card in `<WalkthroughVideo>`, the
 * inline block in the onboarding "Book a call" promo).
 *
 * Fetched HERE rather than through the lib's `useWalkthroughVideo` hook, for
 * exactly one reason: that hook calls a bare `fetch`. The route is public on
 * the hub, but we reach it through the tenant gateway's `/content` proxy,
 * which the gateway role-gates (`/content/**` → `hasAnyRole(AGENT, ADMIN)`).
 * A bare `fetch` only ever carries a session cookie — so it 401s in dev-ticket
 * mode (bearer auth, no cookie) and in the native shell (absolute cross-origin
 * URL). `embedAuthedFetch` is what every other embeddable `/content` surface
 * in this app uses: it attaches the bearer in bearer mode, sends
 * `credentials: 'include'`, sanctions the native shell's gateway origin, and
 * refresh-retries a 401 — all off the SAME `EmbedAuthAdapter` the chat
 * registers at module load in `openframe-chat-runtime-provider`. Precedent:
 * `useRelease` in `help-center/releases/detail/release-detail-client.tsx`.
 *
 * Feeding `video` straight into the widget is the lib's supported host path
 * (it's what the hub's SSR mount does); only client-only embedders with no
 * auth to attach need the lib hook.
 *
 * One React Query key, so the second consumer costs no extra request and both
 * surfaces show the same video.
 */

import type { WalkthroughVideoData } from '@flamingo-stack/openframe-frontend-core/components/features';
import { embedAuthedFetch, walkthroughDismissCookieName } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQuery } from '@tanstack/react-query';
import { CONTENT_BASE, EP } from '@/app/(app)/help-center/endpoints';
import { getCurrentPlatform } from '@/lib/app-config';

/**
 * Per-platform dismissal cookie, same naming the hub uses. Lives beside the
 * fetch because dismissal is ONE decision across the app, not per surface:
 * closing the video in the onboarding promo must also stop the floating card
 * from re-offering it in the corner, and vice versa — so both mounts pass this
 * same key and share the cookie.
 */
export const WALKTHROUGH_DISMISS_STORAGE_KEY = walkthroughDismissCookieName(getCurrentPlatform());

/**
 * Mirrors the lib hook's contract: the endpoint takes no platform param (the
 * hub resolves it server-side) and answers the RAW body `{ walkthroughVideo }`
 * — `null` when that platform has none. A real HTTP failure THROWS so React
 * Query retries instead of caching a fake "no video".
 *
 * 404 AND 410 are both "no video", not failures. 410 is what the hub answers
 * for a walkthrough video that was DELETED (as opposed to never configured),
 * which is a perfectly ordinary state for a non-production environment — and
 * treating it as an error is worse than useless here, because a 410 is
 * cacheable by default: the browser pins it in the disk cache and every later
 * mount fails from cache without a request, so nothing recovers short of a
 * cache clear. `cache: 'no-store'` keeps that from happening again for any
 * status; React Query's own `staleTime` is the caching layer this read wants.
 */
export interface WalkthroughVideoResult {
  /** The video, or `null` while loading AND when the platform has none. */
  video: WalkthroughVideoData | null;
  /**
   * True until the request settles — the ONLY way to tell "no video yet" from
   * "no video at all", which are the same `null` and want opposite UI: a
   * placeholder holding the space, versus nothing at all.
   */
  isLoading: boolean;
}

export function useWalkthroughVideoData(): WalkthroughVideoResult {
  const query = useQuery<WalkthroughVideoData | null>({
    queryKey: ['walkthrough-video', EP.walkthroughVideo],
    // Matches the lib hook's window — the floating widget is mounted for the
    // whole session, so this only governs refetch-on-remount after a hard nav.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await embedAuthedFetch(EP.walkthroughVideo, { cache: 'no-store' });
      if (res.status === 404 || res.status === 410) return null;
      if (!res.ok) throw new Error(`Walkthrough video request failed (${res.status})`);
      const body = (await res.json()) as { walkthroughVideo: WalkthroughVideoData | null };
      const video = body?.walkthroughVideo ?? null;
      // `captionsUrl` arrives as a RELATIVE hub path (`/api/captions/…`), which
      // would otherwise resolve against this app's origin — re-prefix it onto
      // the same `/content` proxy. Done in `queryFn`, not a `select`: the lib
      // hook needs `select` to keep the shared cache clean for other observers,
      // but every consumer here wants the same rewrite, and rewriting once
      // keeps the cached object IDENTITY-STABLE across renders. That matters —
      // a fresh `video` object restarts the widget's appear-delay timer on
      // every re-render of the surface that mounts it.
      if (video?.captionsUrl?.startsWith('/')) {
        return { ...video, captionsUrl: `${CONTENT_BASE}${video.captionsUrl}` };
      }
      return video;
    },
  });

  return { video: query.data ?? null, isLoading: query.isPending };
}
