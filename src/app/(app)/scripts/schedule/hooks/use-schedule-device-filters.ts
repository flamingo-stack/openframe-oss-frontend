'use client';

import { useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scheduleDeviceFiltersRelayQuery as ScheduleDeviceFiltersQueryType } from '@/__generated__/scheduleDeviceFiltersRelayQuery.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { useRetryKey } from '@/app/components/shared';
import { toDeviceFilters } from '@/graphql/devices/device-facets-fields';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { scheduleDeviceFiltersRelayQuery } from '@/graphql/scripts/schedule-device-filters-relay';
import { UNFILTERED } from '../utils/schedule-device-filters';

/** Which of the schedule's two device sets the facets describe. */
export type ScheduleDeviceHalf = 'assigned' | 'available';

interface ScheduleDeviceFiltersOptions {
  /**
   * Resolve BOTH halves, not just the one being read — for the picker, where the
   * user flips between them: the tab then stays out of the query variables, so
   * switching reads the store instead of suspending the editor mid-click. A
   * surface with one list leaves this off and pays for one set of facets.
   */
  prefetchOtherHalf?: boolean;
}

/**
 * Filter facets for one of a schedule's device sets, scoped to THAT set.
 *
 * The fleet-wide `useDeviceFilters` counts every machine in the tenant, which is
 * not the set any of these lists shows: available devices are scoped to the
 * schedule's platforms, assigned ones to what it actually runs on. Reading the
 * schedule's own facet fields keeps each funnel offering only values that narrow
 * the rows beside it.
 *
 * **The narrowing is deliberately NOT passed in.** A funnel has to keep offering
 * the values the user has not picked yet: send the current filter and the
 * server answers each dimension through it, so choosing "Windows" leaves OS with
 * Windows as its only option and choosing one customer makes the second
 * unpickable — the funnel closes behind the first click. Proper faceted search
 * excludes a dimension from its OWN facet, which this schema cannot express in
 * one round trip, so the options describe the whole half instead. That is the
 * same call `UNFILTERED` already documents for the criteria dropdowns.
 *
 * The counts are therefore per-half totals, not "how many rows match what is on
 * screen". The narrowed number is the LIST's to report, and it does — from its
 * connection's `filteredCount`.
 *
 * Tags come from the fleet-wide facets until the scoped fields carry them — see
 * `toDeviceFilters`; a tag no assigned device carries just returns nothing.
 *
 * **Suspends** — render it inside the same boundary as the list it narrows. It
 * has no narrowing of its own to change, so it settles once and then stays put
 * while the user filters.
 */
export function useScheduleDeviceFilters(
  scheduleId: string,
  half: ScheduleDeviceHalf,
  options?: ScheduleDeviceFiltersOptions,
): DeviceFilters {
  const bothHalves = options?.prefetchOtherHalf ?? false;
  const retryKey = useRetryKey();

  const data = useLazyLoadQuery<ScheduleDeviceFiltersQueryType>(
    scheduleDeviceFiltersRelayQuery,
    {
      scheduleId,
      // See above: the options describe the half, not the current narrowing.
      filter: toRelayDeviceFilter(UNFILTERED),
      search: null,
      // Not `half === …` alone: with `prefetchOtherHalf` the variables stay
      // constant across a tab switch, which is what keeps that switch free.
      available: bothHalves || half === 'available',
      assigned: bothHalves || half === 'assigned',
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const schedule = data.scriptSchedule;
  const facets = half === 'assigned' ? schedule?.assignedDeviceFilters : schedule?.availableDeviceFilters;

  // Tags only — see above. Unfiltered for the same reason the scoped query is:
  // a tag chip must not remove the other tags from the menu.
  const fleetFacets = useDeviceFilters(UNFILTERED);

  // Memoized because a fresh copy per render rebuilds the table's column defs
  // and filter groups on every keystroke in the search box.
  return useMemo(() => toDeviceFilters(facets, fleetFacets.tagKeys), [facets, fleetFacets.tagKeys]);
}
