'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDeviceOrganizationCounts } from '@/app/(app)/devices/queries/devices-api';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';

const EMPTY_DEVICE_COUNTS: ReadonlyMap<string, number> = new Map();

/**
 * Device count per organization, for the customers table's DEVICES column.
 *
 * The visible ids gate the request but are not part of it: the backend's
 * organization facet self-excludes `organizationIds` (see
 * `fetchDeviceOrganizationCounts`), so every page of the table gets the same
 * tenant-wide map. Sending them only fragmented the cache — one identical
 * refetch per pagination, search or filter change.
 */
export function useCustomerDeviceCounts(organizationIds: string[]): {
  deviceCounts: ReadonlyMap<string, number>;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: deviceQueryKeys.countsBy({}),
    queryFn: () => fetchDeviceOrganizationCounts(),
    enabled: organizationIds.length > 0,
    staleTime: 30_000,
  });

  return {
    deviceCounts: query.data ?? EMPTY_DEVICE_COUNTS,
    isLoading: query.isLoading,
  };
}
