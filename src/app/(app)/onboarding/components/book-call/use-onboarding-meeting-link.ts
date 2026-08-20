'use client';

/**
 * Resolves WHICH HubSpot meeting link the onboarding "Book a call" promo books.
 *
 * The hub serves a directory of curated scheduling links grouped by audience
 * (`GET /content/api/meetings`); this app books exactly one of them, so the
 * whole directory UI (`<MeetingSchedulerDirectory>`) is skipped and the promo
 * goes straight into `<HubSpotMeetingScheduler>` for the resolved link.
 *
 * Fetched with `embedAuthedFetch` for the same reason as the walkthrough video
 * — the gateway role-gates `/content/**`, so a bare `fetch` 401s in dev-ticket
 * mode and in the native shell. See {@link useWalkthroughVideoData}.
 */

import type {
  SchedulingLink,
  SchedulingLinksPayload,
} from '@flamingo-stack/openframe-frontend-core/schemas/meeting-booking-schema';
import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQuery } from '@tanstack/react-query';
import { EP } from '@/app/(app)/help-center/endpoints';

/**
 * Audience group this promo books into — the slugified label of the hub's
 * "OpenFrame Users" audience. Content-managed on the hub side, which is why
 * {@link pickOnboardingLink} falls back to the first link in the directory
 * rather than showing nothing: a renamed audience should degrade to "some
 * onboarding call" instead of silently removing the promo.
 */
const ONBOARDING_PURPOSE = 'openframe-users';

/** First link of the onboarding audience; else the first link the hub offers. */
function pickOnboardingLink(payload: SchedulingLinksPayload | null | undefined): SchedulingLink | null {
  const groups = payload?.purposes ?? [];
  const preferred = groups.find(group => group.purpose === ONBOARDING_PURPOSE);
  return preferred?.links[0] ?? groups.find(group => group.links.length > 0)?.links[0] ?? null;
}

export interface OnboardingMeetingLinkResult {
  /** The link to book, or `null` while loading and when the hub offers none. */
  link: SchedulingLink | null;
  /** True until the directory settles — distinguishes "loading" from "none". */
  isLoading: boolean;
}

export function useOnboardingMeetingLink(): OnboardingMeetingLinkResult {
  const query = useQuery<SchedulingLinksPayload | null>({
    queryKey: ['scheduling-links', EP.meetings],
    // The directory changes at content-editing speed, and both promo surfaces
    // (dashboard card + /onboarding) read it — one fetch covers a session.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // `no-store`: a 404/410 is cacheable by default, so a browser that once
      // saw one would keep serving it from disk cache and the promo would stay
      // hidden with no request to explain it. React Query's `staleTime` above
      // is this read's caching layer.
      const res = await embedAuthedFetch(EP.meetings, { cache: 'no-store' });
      // 404/410 = this hub has no scheduling links (never configured, or the
      // link was deleted). A `null` is the right answer; every OTHER failure
      // throws so React Query retries instead of hiding the promo for good.
      if (res.status === 404 || res.status === 410) return null;
      if (!res.ok) throw new Error(`Scheduling links request failed (${res.status})`);
      return (await res.json()) as SchedulingLinksPayload;
    },
  });

  return { link: pickOnboardingLink(query.data), isLoading: query.isPending };
}
