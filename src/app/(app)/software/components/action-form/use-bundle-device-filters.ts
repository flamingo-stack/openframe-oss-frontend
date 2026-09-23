'use client';

import { useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useBundleDeviceFiltersQuery as BundleDeviceFiltersQueryType } from '@/__generated__/useBundleDeviceFiltersQuery.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { DeviceFilterInput, DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { useRetryKey } from '@/app/components/shared';
import { toDeviceFilters } from '@/graphql/devices/device-facets-fields';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';

/**
 * Both halves at once, always: the picker flips between them, and with the tab
 * out of the variables a switch reads the store instead of suspending the
 * editor mid-click.
 */
const bundleDeviceFiltersQuery = graphql`
  query useBundleDeviceFiltersQuery($bundleId: ID!, $filter: DeviceFilterInput) {
    softwareBundle(id: $bundleId) {
      id
      availableDeviceFilters(filter: $filter) {
        ...deviceFacetsFields_filters
      }
      assignedDeviceFilters(filter: $filter) {
        ...deviceFacetsFields_filters
      }
    }
  }
`;

/**
 * Filter facets for one of a bundle's device sets, scoped to THAT set and to
 * the form's own scope.
 *
 * `scope` — the OS the chosen packages install on, live devices only — IS sent,
 * because it is not something the user picked in a funnel: it is the frame the
 * whole picker sits in, the way a script schedule's `supportedPlatforms` frames
 * its picker server-side. The user's narrowing is deliberately NOT sent, for the
 * reason `useScheduleDeviceFilters` gives: a funnel answered through its own
 * selection offers one option after the first click.
 *
 * **Suspends** — render it inside the same boundary as the list it narrows.
 */
export function useBundleDeviceFilters(
  bundleId: string,
  half: 'assigned' | 'available',
  scope: DeviceFilterInput,
): DeviceFilters {
  const retryKey = useRetryKey();

  const data = useLazyLoadQuery<BundleDeviceFiltersQueryType>(
    bundleDeviceFiltersQuery,
    { bundleId, filter: toRelayDeviceFilter(scope) },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const bundle = data.softwareBundle;
  const facets = half === 'assigned' ? bundle?.assignedDeviceFilters : bundle?.availableDeviceFilters;

  // Tags only — see `toDeviceFilters`. Unscoped, so a tag chip does not remove
  // the other tags from the menu.
  const fleetFacets = useDeviceFilters();

  return useMemo(() => toDeviceFilters(facets, fleetFacets.tagKeys), [facets, fleetFacets.tagKeys]);
}
