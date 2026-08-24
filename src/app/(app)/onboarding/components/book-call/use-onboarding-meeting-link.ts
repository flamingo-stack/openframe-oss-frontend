'use client';

/**
 * Resolves WHICH HubSpot meeting link the onboarding "Book a call" promo books.
 *
 * The hub serves a directory grouped by audience (`GET /content/api/meetings`);
 * this app books exactly one link, so the directory UI is skipped entirely.
 * `embedAuthedFetch` for the same reason as {@link useWalkthroughVideoData} —
 * the gateway role-gates `/content/**`.
 */

import type {
  SchedulingLink,
  SchedulingLinksPayload,
} from '@flamingo-stack/openframe-frontend-core/schemas/meeting-booking-schema';
import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQuery } from '@tanstack/react-query';
import { EP } from '@/app/(app)/help-center/endpoints';
import { SCHEDULING_LINKS_KEY } from '@/hooks/admin-query-keys';

/** Slugified label of the hub's "OpenFrame Users" audience — content-managed. */
const ONBOARDING_PURPOSE = 'openframe-users';

/**
 * First link of the onboarding audience; else the first link on offer. The
 * fallback matters because the audience label is content-managed: a rename
 * should degrade to "some onboarding call", not remove the promo.
 */
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
    queryKey: [...SCHEDULING_LINKS_KEY, EP.meetings],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // `no-store`: a 404/410 is cacheable by default, and a pinned one would
      // hide the promo with no request left to explain it.
      const res = await embedAuthedFetch(EP.meetings, { cache: 'no-store' });
      // 404/410 = this hub has no scheduling links. Anything else throws so
      // React Query retries instead of hiding the promo for good.
      if (res.status === 404 || res.status === 410) return null;
      if (!res.ok) throw new Error(`Scheduling links request failed (${res.status})`);
      return (await res.json()) as SchedulingLinksPayload;
    },
  });

  return { link: pickOnboardingLink(query.data), isLoading: query.isPending };
}
