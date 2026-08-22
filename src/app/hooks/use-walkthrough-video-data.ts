'use client';

/**
 * This app's read of `/content/api/walkthrough-video`, for the inline block in
 * the onboarding "Book a call" promo.
 *
 * Not the lib's `useWalkthroughVideo`: that hook uses a bare `fetch`, which
 * carries only a session cookie and so 401s against the gateway's role-gated
 * `/content/**` in dev-ticket mode and in the native shell. `embedAuthedFetch`
 * is what every other `/content` surface here uses.
 */

import type { WalkthroughVideoData } from '@flamingo-stack/openframe-frontend-core/components/features';
import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQuery } from '@tanstack/react-query';
import { CONTENT_BASE, EP } from '@/app/(app)/help-center/endpoints';

export interface WalkthroughVideoResult {
  /** The video, or `null` while loading AND when the platform has none. */
  video: WalkthroughVideoData | null;
  /** Until this settles, `null` means "not yet" — the two want opposite UI. */
  isLoading: boolean;
}

export function useWalkthroughVideoData(): WalkthroughVideoResult {
  const query = useQuery<WalkthroughVideoData | null>({
    queryKey: ['walkthrough-video', EP.walkthroughVideo],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // `no-store` because a 410 (video deleted) is cacheable by default: the
      // browser would pin it and later mounts would fail without a request.
      const res = await embedAuthedFetch(EP.walkthroughVideo, { cache: 'no-store' });
      // 404/410 = no video configured. Anything else throws so React Query
      // retries instead of caching a fake "no video".
      if (res.status === 404 || res.status === 410) return null;
      if (!res.ok) throw new Error(`Walkthrough video request failed (${res.status})`);
      const body = (await res.json()) as { walkthroughVideo: WalkthroughVideoData | null };
      const video = body?.walkthroughVideo ?? null;
      // `captionsUrl` arrives as a relative hub path and would otherwise
      // resolve against this app's origin. Rewritten here, not in `select`, to
      // keep the cached object identity stable — a fresh object restarts the
      // widget's appear-delay timer on every re-render.
      if (video?.captionsUrl?.startsWith('/')) {
        return { ...video, captionsUrl: `${CONTENT_BASE}${video.captionsUrl}` };
      }
      return video;
    },
  });

  return { video: query.data ?? null, isLoading: query.isPending };
}
