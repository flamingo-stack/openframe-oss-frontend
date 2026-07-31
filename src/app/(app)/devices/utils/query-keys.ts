'use client';

import type { QueryClient } from '@tanstack/react-query';
import { dashboardQueryKeys } from '@/app/(app)/dashboard/utils/query-keys';
import type { DeviceFilterInput } from '../types/device.types';
import { bumpDeviceEpoch } from './device-refresh';

/**
 * Every REACT-QUERY device read hangs off the `['devices']` root — the bounded
 * page, the whole-fleet walk, details and counters. (The list, the pickers and
 * the filter facets are Relay, and refresh via the device epoch instead — see
 * `invalidateDeviceQueries` below.) That single prefix is what lets one call
 * refresh every react-query device surface; a device query keyed outside it
 * silently keeps serving stale data after an archive or delete, which is how the
 * screens drifted apart in the first place.
 *
 * Adding a device query means adding its key here, never inventing a literal at
 * the call site.
 */
export const deviceQueryKeys = {
  all: ['devices'] as const,

  lists: () => [...deviceQueryKeys.all, 'list'] as const,
  /** Single bounded page (the ticket-form device autocomplete). */
  page: (filter: DeviceFilterInput, search: string, first: number) =>
    [...deviceQueryKeys.lists(), 'page', filter, search, first] as const,
  /** Whole fleet matching a filter, fetched by following the cursor. */
  full: (filter: DeviceFilterInput) => [...deviceQueryKeys.lists(), 'full', filter] as const,

  detail: (machineId: string) => [...deviceQueryKeys.all, 'detail', machineId] as const,

  counts: () => [...deviceQueryKeys.all, 'counts'] as const,
  countsBy: (filter: DeviceFilterInput) => [...deviceQueryKeys.counts(), filter] as const,
  /** Dashboard status breakdown (total / online / offline / pending / archived). */
  stats: () => [...deviceQueryKeys.all, 'stats'] as const,
} as const;

/**
 * Refresh every surface that shows device data after a device mutation.
 *
 * Device reads are split across TWO caches, and a mutation has to reach both:
 *
 * - **Relay** owns the list, the facets and the pickers. Bumping the device
 *   epoch changes the `fetchKey` those queries pass, which is the only thing
 *   that refetches a query already on screen — `store.invalidateStore()` does
 *   NOT, because `QueryResource` returns its retained entry without re-checking
 *   staleness. See `device-refresh.ts`.
 * - **react-query** owns the whole-fleet lookup, the detail page, the counters,
 *   and the customers overview (one query joining organization rows to device
 *   counts, hence the dashboard key).
 *
 * Active views refetch immediately, inactive ones on next mount — no view needs
 * to wire its own refetch callback.
 */
export function invalidateDeviceQueries(queryClient: QueryClient): void {
  bumpDeviceEpoch();
  queryClient.invalidateQueries({ queryKey: deviceQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.orgStatsAll() });
}
