'use client';

import { useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { devicesPageRelayQuery as DevicesPageRelayQueryType } from '@/__generated__/devicesPageRelayQuery.graphql';
import { devicesPageRelayQuery } from '@/graphql/devices/devices-page-relay';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import type { Device, DeviceFilterInput } from '../types/device.types';
import { useDeviceEpoch } from '../utils/device-refresh';
import { readMachineEdges } from '../utils/read-machine';

/** Result cap for the pickers. They render what fits; they do not paginate. */
export const DEVICE_LIST_LIMIT = 100;

export interface UseDeviceListOptions {
  filter?: DeviceFilterInput;
  search?: string;
  first?: number;
  /**
   * Extra cache-breaker, for a retry after this query threw.
   *
   * Remounting the error boundary is NOT enough: Relay caches the thrown Error
   * under a key built from `forceUpdateKey-fetchKey`, and a remount resets
   * `forceUpdateKey` to 0, so the same entry is found and re-thrown. Only a
   * different fetch key produces a real refetch.
   */
  retryKey?: number;
}

export interface DeviceListResult {
  devices: Device[];
  filteredCount: number;
}

/**
 * A single bounded page of devices, for the surfaces that PICK from the fleet
 * rather than browse it: the run/test-script device pickers and the schedule
 * assign view, all of them through `DeviceListPicker`.
 *
 * NOT the ticket-form autocomplete — that re-queries per keystroke and uses the
 * imperative `fetchDevicesPage` so a Suspense boundary can't blank the open
 * dropdown between characters.
 *
 * **Suspends.** There is no `enabled` flag — a Relay query either runs or its
 * component isn't rendered. Callers gate by not mounting: render this hook's
 * component inside `{isOpen && <Suspense fallback={…}>…</Suspense>}`, which is
 * what the modals were already doing structurally with `enabled: isOpen`.
 *
 * Devices arrive as `Machine` records in the Relay store, shared by `id` with
 * the Devices list and the schedule tables — so a picker cannot show a different
 * hostname or status than the page the user opened it from.
 */
export function useDeviceList({
  filter,
  search = '',
  first = DEVICE_LIST_LIMIT,
  retryKey = 0,
}: UseDeviceListOptions = {}) {
  const fetchKey = `${useDeviceEpoch()}-${retryKey}`;

  const data = useLazyLoadQuery<DevicesPageRelayQueryType>(
    devicesPageRelayQuery,
    { filter: toRelayDeviceFilter(filter), search: search || null, first },
    { fetchPolicy: 'store-and-network', fetchKey },
  );

  return useMemo<DeviceListResult>(
    () => ({
      devices: readMachineEdges(data.devices?.edges),
      filteredCount: data.devices?.filteredCount ?? 0,
    }),
    [data],
  );
}
