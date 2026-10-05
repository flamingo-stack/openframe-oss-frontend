'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAllDevices } from '../queries/devices-api';
import type { Device, DeviceFilterInput } from '../types/device.types';
import { deviceQueryKeys } from '../utils/query-keys';

const EMPTY_DEVICES: Device[] = [];

export interface UseAllDevicesOptions {
  filter?: DeviceFilterInput;
  enabled?: boolean;
}

/**
 * The whole fleet matching `filter`, paged to exhaustion.
 *
 * For the monitoring tables, which use the device registry as a lookup keyed by
 * Fleet host id and so need every device, not a page of them.
 *
 * Deliberately still react-query, not a Relay hook: this is a cursor walk whose
 * result is a lookup table for plain code, not a list a user scrolls, and Relay
 * has no "load every page" primitive — `usePaginationFragment` would mean
 * driving `loadNext` from an effect until it runs dry. The underlying
 * `fetchAllDevices` DOES run the Relay document, so the rows still land in the
 * store as normalized `Machine` records; only the loop and its cache live here.
 */
export function useAllDevices({ filter, enabled = true }: UseAllDevicesOptions = {}) {
  const query = useQuery({
    queryKey: deviceQueryKeys.full(filter ?? {}),
    queryFn: () => fetchAllDevices({ filter }),
    enabled,
    staleTime: 30 * 1000,
  });

  return {
    devices: query.data ?? EMPTY_DEVICES,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
