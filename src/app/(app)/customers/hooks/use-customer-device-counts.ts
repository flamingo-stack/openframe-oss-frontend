'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchDeviceOrganizationCounts } from '@/app/(app)/devices/queries/devices-api';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';

const EMPTY_DEVICE_COUNTS: ReadonlyMap<string, number> = new Map();

/** Device count per organization, for the customers table's DEVICES column. */
export function useCustomerDeviceCounts(organizationIds: string[]): {
  deviceCounts: ReadonlyMap<string, number>;
  isLoading: boolean;
} {
  const filter = useMemo(() => ({ organizationIds: [...organizationIds].sort() }), [organizationIds]);

  const query = useQuery({
    queryKey: deviceQueryKeys.countsBy(filter),
    queryFn: () => fetchDeviceOrganizationCounts(filter),
    enabled: filter.organizationIds.length > 0,
    staleTime: 30_000,
  });

  return {
    deviceCounts: query.data ?? EMPTY_DEVICE_COUNTS,
    isLoading: query.isLoading,
  };
}
