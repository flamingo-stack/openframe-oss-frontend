'use client';

import { useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { devicesListRelay_query$key } from '@/__generated__/devicesListRelay_query.graphql';
import type { devicesListRelayPaginationQuery as DevicesListRelayPaginationQueryType } from '@/__generated__/devicesListRelayPaginationQuery.graphql';
import type { devicesListRelayQuery as DevicesListRelayQueryType } from '@/__generated__/devicesListRelayQuery.graphql';
import { devicesListRelayFragment, devicesListRelayQuery } from '@/graphql/devices/devices-list-relay';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { DEVICES_PAGE_SIZE } from '../queries/devices-api';
import type { Device, DeviceFilterInput } from '../types/device.types';
import { useDeviceEpoch } from '../utils/device-refresh';
import { readMachineEdges } from '../utils/read-machine';

export interface UseDevicesResult {
  devices: Device[];
  filteredCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

/**
 * The scrolled device list — the Devices page, the customer devices tab and the
 * archive page.
 *
 * **Suspends** on first load and on any filter/search change. Callers render it
 * inside a `<Suspense>`; to keep the previous page visible while a new filter
 * loads (rather than dropping to the fallback), pass DEFERRED filter/search —
 * see `DevicesPanel`, which defers them so a filter change is a transition.
 *
 * Relay owns the cursors and page merging that the previous `useInfiniteQuery`
 * did by hand, and the rows are normalized `Machine` records shared with every
 * device picker and schedule table in the app.
 */
export function useDevices(filters?: DeviceFilterInput, search = ''): UseDevicesResult {
  // Refetches this query when a device mutation bumps the epoch — the only way
  // to refresh a Relay query that is already mounted. See `device-refresh.ts`.
  const fetchKey = useDeviceEpoch();

  const root = useLazyLoadQuery<DevicesListRelayQueryType>(
    devicesListRelayQuery,
    { filter: toRelayDeviceFilter(filters), search: search || null, first: DEVICES_PAGE_SIZE },
    { fetchPolicy: 'store-and-network', fetchKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    DevicesListRelayPaginationQueryType,
    devicesListRelay_query$key
  >(devicesListRelayFragment, root);

  const devices = useMemo(() => readMachineEdges(data.devices?.edges), [data.devices?.edges]);

  // KNOWN LIMITATION: this refetches from the head (`after: null`), and
  // `ConnectionHandler` REPLACES rather than merges on a head fetch, so a user
  // who has scrolled past page 1 is snapped back to the first 20 rows after a
  // device mutation. Refetching via `usePaginationFragment`'s `refetch` at the
  // loaded size was tried and dropped `filteredCount` (the row counter
  // disappeared), so it is not a straight swap. The correct fix is a
  // `ConnectionHandler` updater applied from the mutation — but the delete call
  // is REST (`apiClient.post`), not a Relay mutation, so that needs the
  // mutation moved to Relay first.
  const fetchNextPage = useCallback(() => loadNext(DEVICES_PAGE_SIZE), [loadNext]);

  return {
    devices,
    filteredCount: data.devices?.filteredCount ?? 0,
    hasNextPage: hasNext,
    isFetchingNextPage: isLoadingNext,
    fetchNextPage,
  };
}
