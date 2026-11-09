'use client';

import type { DeviceFilterInput, DeviceFilters } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useMemo } from 'react';
import { graphql } from 'react-relay';
import type { useDirectoryFacetsQuery } from '@/__generated__/useDirectoryFacetsQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { withSelected } from '@/lib/facet-options';

const directoryFacetsQuery = graphql`
  query useDirectoryFacetsQuery($filter: DeviceFilterInput, $list: Boolean!) {
    deviceFilters(filter: $filter) @include(if: $list) {
      directorySources {
        value
        count
      }
      userLinks {
        value
        count
      }
    }
  }
`;

/**
 * What the USER and SOURCES funnels offer, apart from `useDeviceFilters` on purpose. `deviceFilters` is non-null, so a
 * failed facet fails the whole document, and these two read Pinot columns that saas-shared applies on its own release:
 * in one document, a missing column took every funnel on the list and in the pickers with it.
 *
 * Never suspends or throws, so the rows and the other funnels do not wait for it. Until it answers, or if it fails,
 * these two offer only what the list is already narrowed by: a selected value always has a funnel to clear it from,
 * and an unselected one has nothing to offer yet. A device mutation does not refresh these counts: the next narrowing
 * or the store's expiry does.
 */
export function useDirectoryFacets(
  filters: DeviceFilterInput,
  enabled: boolean,
): Pick<DeviceFilters, 'directorySources' | 'userLinks'> {
  const filter = toRelayDeviceFilter(filters);
  const { data } = useNonSuspendingQuery<useDirectoryFacetsQuery>(
    directoryFacetsQuery,
    { filter, list: true },
    enabled,
  );
  const facets = enabled ? data.deviceFilters : undefined;
  // The URL's values, not `filter`'s: the funnels tick those, and a value `toRelayDeviceFilter` drops must stay on offer
  // to untick. A string, not arrays: compared by value, so a rebuilt array does not defeat the memo below.
  const selectedKey = enabled ? JSON.stringify([filters.directorySources ?? [], filters.userLinks ?? []]) : '[[],[]]';

  // Memoized because a fresh copy per render rebuilds the table's column defs, as in `useDeviceFilters`.
  return useMemo(() => {
    const [selectedSources, selectedLinks]: string[][] = JSON.parse(selectedKey);
    const atZero = (value: string) => ({ value, count: 0 });
    return {
      directorySources: withSelected(
        (facets?.directorySources ?? []).map(({ value, count }) => ({ value, count })),
        selectedSources,
        atZero,
      ),
      userLinks: withSelected(
        (facets?.userLinks ?? []).map(({ value, count }) => ({ value, count })),
        selectedLinks,
        atZero,
      ),
    };
  }, [facets, selectedKey]);
}
