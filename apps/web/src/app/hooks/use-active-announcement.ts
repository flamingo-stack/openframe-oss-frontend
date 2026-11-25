'use client';

/**
 * The hub's active announcement for the app shell's top bar: the ONLY fetcher of it (CU-17tkuw69v1p).
 *
 * The lib bar could fetch it itself, but then the answer never reached this device's store, and the next load
 * seeded an old one. So the app fetches, stores every answer (`announcement-cache.ts`, which the `<head>` seed
 * reads before paint) and hands it to the bar, which then never fetches. The store also seeds this query, so a
 * reload draws the stored bar at once and replaces it only if the hub now answers differently.
 *
 * `embedAuthedFetch` for the same reason as `useWalkthroughVideoData`: the gateway role-gates `/content/**`, and
 * in a native shell `/content` is absolute. Refetched when the tab is focused again after a minute (the hub's
 * cache TTL), as the lib bar did on visibility.
 */

import type { Announcement, AnnouncementResponse } from '@flamingo-stack/openframe-frontend-core/types';
import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CONTENT_ENDPOINTS } from '@/app/(app)/help-center/endpoints';
import { readStoredAnnouncement, storeAnnouncement } from '@/lib/announcement-cache';
import { shellKind } from '@/lib/platform';

const ANNOUNCEMENT_URL = CONTENT_ENDPOINTS.announcementsUrl;
const REVALIDATE_AFTER_MS = 60_000;

export const activeAnnouncementQueryKey = ['hub-announcement', ANNOUNCEMENT_URL] as const;

async function fetchActiveAnnouncement(): Promise<Announcement | null> {
  const res = await embedAuthedFetch(ANNOUNCEMENT_URL, { cache: 'no-store' });
  // 404/410: this hub serves no announcements.
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Announcement request failed (${res.status})`);
  const body = (await res.json()) as AnnouncementResponse;
  return body.announcement ?? null;
}

/**
 * The announcement for the bar: the stored one at once on a reload, then the hub's answer. `null` until the
 * first answer when nothing is stored, and when the hub has none. Never `undefined`, so the bar never self-fetches.
 */
export function useActiveAnnouncement(): Announcement | null {
  // Read once, on mount: the bar mounts only on the client, after the session answers, so this is no hydration read.
  const [stored] = useState(() => readStoredAnnouncement());
  const { data, dataUpdatedAt } = useQuery({
    queryKey: activeAnnouncementQueryKey,
    queryFn: fetchActiveAnnouncement,
    staleTime: REVALIDATE_AFTER_MS,
    refetchOnWindowFocus: true,
    // The stored answer as of when it was fetched: a fresh one is not asked again, an older one is, and an
    // unchanged answer keeps the stored object (structural sharing), so the bar does not re-render it.
    ...(stored ? { initialData: stored.announcement, initialDataUpdatedAt: stored.storedAt } : {}),
  });

  useEffect(() => {
    if (data === undefined || dataUpdatedAt === 0) return;
    storeAnnouncement(data, shellKind(), dataUpdatedAt);
  }, [data, dataUpdatedAt]);

  return data ?? null;
}
