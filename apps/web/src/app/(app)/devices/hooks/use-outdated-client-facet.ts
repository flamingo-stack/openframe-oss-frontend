'use client';

import {
  DEVICE_FILTER_OUTDATED,
  type DeviceFilterInput,
  type DeviceFilters,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useMemo } from 'react';
import type { outdatedClientCountRelayQuery } from '@/__generated__/outdatedClientCountRelayQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { outdatedClientCountRelayQuery as query } from '@/graphql/devices/outdated-client-count-relay';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';

/**
 * What the Status funnel's OUTDATED option counts, apart from `useDeviceFilters` (see `outdatedClientCountRelayQuery`
 * for why). Never suspends or throws, so the rows and the other funnels do not wait for it.
 *
 * Until it answers, or if it fails, OUTDATED is offered only while it is ticked (at 0), so the tick can always be taken
 * back; unticked, there is nothing to offer yet. Like `useDirectoryFacets`, a device mutation does not refresh it: the
 * next narrowing or the store's expiry does.
 *
 * @param selectedStatuses the Status funnel's ticks, as the address has them (OUTDATED included).
 * @param enabled off where the Status funnel is hidden (the archive page): nothing is asked.
 */
export function useOutdatedClientFacet(
  filters: DeviceFilterInput,
  selectedStatuses: readonly string[],
  enabled: boolean,
): Pick<DeviceFilters, 'clientOutdated'> {
  const { data } = useNonSuspendingQuery<outdatedClientCountRelayQuery>(
    query,
    { filter: toRelayDeviceFilter(filters), list: true },
    enabled,
  );
  const facet = enabled ? data.deviceFilters?.clientOutdated : undefined;
  const ticked = enabled && selectedStatuses.includes(DEVICE_FILTER_OUTDATED);

  // Memoized because a fresh copy per render rebuilds the table's column defs, as in `useDeviceFilters`.
  return useMemo(() => {
    if (facet) return { clientOutdated: facet.map(({ value, count }) => ({ value, count })) };
    return ticked ? { clientOutdated: [{ value: 'true', count: 0 }] } : {};
  }, [facet, ticked]);
}
