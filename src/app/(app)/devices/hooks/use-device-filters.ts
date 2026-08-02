'use client';

import { useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { deviceFiltersRelayQuery as DeviceFiltersRelayQueryType } from '@/__generated__/deviceFiltersRelayQuery.graphql';
import { deviceFiltersRelayQuery } from '@/graphql/devices/device-filters-relay';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import type { DeviceFilterInput, DeviceFilters } from '../types/device.types';
import { useDeviceEpoch } from '../utils/device-refresh';

/**
 * Filter facets (status / device type / OS / customer / tags) with counts.
 *
 * **Suspends.** Render inside the same boundary as the device list it narrows —
 * the toolbar and the table are one unit, and showing facet counts that don't
 * match the rows below them is worse than showing neither.
 */
export function useDeviceFilters(filters?: DeviceFilterInput): DeviceFilters {
  // Refetches this query when a device mutation bumps the epoch — the only
  // way to refresh a Relay query that is already mounted.
  const fetchKey = useDeviceEpoch();

  const data = useLazyLoadQuery<DeviceFiltersRelayQueryType>(
    deviceFiltersRelayQuery,
    { filter: toRelayDeviceFilter(filters) },
    { fetchPolicy: 'store-and-network', fetchKey },
  );

  // Relay hands back readonly arrays; `DeviceFilters` and the table/filter-modal
  // helpers that consume it are mutable, so copy rather than cast.
  //
  // Memoized because `data.deviceFilters` is store-stable but a fresh copy is
  // not: without this every render hands the table a new object and rebuilds its
  // column defs and filter groups — on every keystroke in the search box.
  return useMemo(
    () => ({
      statuses: [...data.deviceFilters.statuses],
      deviceTypes: [...data.deviceFilters.deviceTypes],
      osTypes: [...data.deviceFilters.osTypes],
      organizationIds: [...data.deviceFilters.organizationIds],
      tagKeys: [...data.deviceFilters.tagKeys],
      filteredCount: data.deviceFilters.filteredCount,
    }),
    [data.deviceFilters],
  );
}
