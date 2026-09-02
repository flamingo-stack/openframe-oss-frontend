'use client';

import { useMemo } from 'react';
import { useFragment, useLazyLoadQuery } from 'react-relay';
import type { scheduleDeviceFiltersRelay_facets$key as FacetsFragmentKey } from '@/__generated__/scheduleDeviceFiltersRelay_facets.graphql';
import type { scheduleDeviceFiltersRelayQuery as ScheduleDeviceFiltersQueryType } from '@/__generated__/scheduleDeviceFiltersRelayQuery.graphql';
import { SCRIPT_TARGETABLE_STATUSES } from '@/app/(app)/devices/constants/device-statuses';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { useRetryKey } from '@/app/components/shared';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import {
  scheduleDeviceFiltersRelayFacetsFragment,
  scheduleDeviceFiltersRelayQuery,
} from '@/graphql/scripts/schedule-device-filters-relay';
import { TARGETABLE_UNFILTERED, UNFILTERED } from '../utils/schedule-device-filters';

/** What a facet-less answer looks like — a schedule that resolved to nothing. */
const EMPTY_FILTERS: DeviceFilters = {
  statuses: [],
  deviceTypes: [],
  osTypes: [],
  organizationIds: [],
  tagKeys: [],
  filteredCount: 0,
};

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
 * The one thing these fields do NOT answer is tags: the backend documents
 * `tagKeys` as "currently always empty for the pickers", so the tag chips would
 * simply stop offering anything — a filter the picker has today, lost to a
 * change that was supposed to sharpen it. They keep coming from the fleet-wide
 * facets until the scoped fields carry them, which is exactly where they came
 * from before and still narrows the scoped list correctly (a tag no assigned
 * device carries just returns nothing).
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
      // The available half is additionally scoped to script-targetable statuses
      // — that is its definition now, not a narrowing (see the query's doc).
      availableFilter: toRelayDeviceFilter(TARGETABLE_UNFILTERED),
      assignedFilter: toRelayDeviceFilter(UNFILTERED),
      search: null,
      // Not `half === …` alone: with `prefetchOtherHalf` the variables stay
      // constant across a tab switch, which is what keeps that switch free.
      available: bothHalves || half === 'available',
      assigned: bothHalves || half === 'assigned',
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const schedule = data.scriptSchedule;
  const facetsKey = (half === 'assigned' ? schedule?.assignedDeviceFilters : schedule?.availableDeviceFilters) as
    FacetsFragmentKey | null | undefined;
  const facets = useFragment(scheduleDeviceFiltersRelayFacetsFragment, facetsKey ?? null);

  // Tags only — see above. Unfiltered for the same reason the scoped query is:
  // a tag chip must not remove the other tags from the menu.
  const fleetFacets = useDeviceFilters(UNFILTERED);

  // Relay hands back readonly arrays; the table and filter-modal helpers that
  // consume `DeviceFilters` mutate theirs, so copy rather than cast. Memoized
  // because a fresh copy per render rebuilds the table's column defs and filter
  // groups on every keystroke in the search box.
  return useMemo(() => {
    if (!facets) return { ...EMPTY_FILTERS, tagKeys: fleetFacets.tagKeys };
    // The `availableFilter` statuses scope does NOT reach the statuses facet:
    // the backend resolves that dimension excluding its own filter, so a
    // "Pending deletion" option comes back offering devices the list never
    // shows (observed on test-env). Stripped here for the available half; the
    // assigned half keeps every status so a stray assigned device stays
    // findable.
    const statuses =
      half === 'available'
        ? facets.statuses.filter(option => (SCRIPT_TARGETABLE_STATUSES as readonly string[]).includes(option.value))
        : [...facets.statuses];
    return {
      statuses,
      deviceTypes: [...facets.deviceTypes],
      osTypes: [...facets.osTypes],
      organizationIds: [...facets.organizationIds],
      // The scoped field's own `tagKeys` is empty by contract; prefer it the
      // moment it stops being, so this falls away without another edit here.
      tagKeys: facets.tagKeys.length > 0 ? [...facets.tagKeys] : fleetFacets.tagKeys,
      filteredCount: facets.filteredCount,
    };
  }, [facets, fleetFacets.tagKeys, half]);
}
