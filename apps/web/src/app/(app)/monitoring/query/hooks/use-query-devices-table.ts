import { DEVICE_ENRICHMENT_FILTER, getDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fleetApiClient } from '@/lib/fleet-api-client';
import { useAllDevices } from '../../../devices/hooks/use-all-devices';
import { indexDevicesByFleetHostId } from '../../../devices/utils/device-action-utils';
import type { QueryDeviceRow } from '../types/query-device-row';

/** Fetch a single page of hosts assigned to a query, using Fleet's page-based pagination. */
async function fetchQueryHostsPage(
  queryId: number,
  page: number,
  pageSize: number
): Promise<{ hosts: Array<{ id: number; hostname: string }>; hasNext: boolean }> {
  const res = await fleetApiClient.getQueryHosts(queryId, { page, per_page: pageSize });
  if (!res.ok) {
    throw new Error(res.error || `Failed to load assigned devices (${res.status})`);
  }
  const hosts = res.data?.hosts ?? [];
  const hasNext = (res.data?.meta?.has_next_results ?? false) && hosts.length > 0;
  return { hosts, hasNext };
}

/**
 * Builds the rows for the Query "Assigned Devices" table by merging the query's
 * assigned Fleet hosts with the device registry (deduplicated by Fleet host id,
 * preferring the most recently seen device). Sorted by display name.
 *
 * Pages through Fleet's host list using the table's own page/pageSize, rather
 * than loading the entire assigned-hosts collection into memory.
 */
export function useQueryDevicesTable(queryId: number | null, page: number = 0, pageSize: number = 100) {
  // The Fleet hosts assigned to this query (id + hostname only), for the current page.
  const hostsQuery = useQuery({
    queryKey: ['query-assigned-hosts', queryId, page, pageSize],
    queryFn: queryId === null ? skipToken : () => fetchQueryHostsPage(queryId, page, pageSize),
  });

  // The full device registry, used to enrich each assigned host with display,
  // organization, OS, status and tag data.
  const {
    devices,
    isLoading: isLoadingDevices,
    error: devicesError,
  } = useAllDevices({ filter: DEVICE_ENRICHMENT_FILTER, enabled: queryId !== null });

  const rows = useMemo<QueryDeviceRow[]>(() => {
    const hosts = hostsQuery.data?.hosts;
    if (!hosts) return [];

    const deviceByFleetId = indexDevicesByFleetHostId(devices);

    // Merge each assigned host with its device data (falling back to the host's
    // own fields when no matching device exists in the registry).
    const result: QueryDeviceRow[] = hosts.map(host => {
      const device = deviceByFleetId.get(host.id);
      return {
        id: String(host.id),
        hostname: device?.hostname || host.hostname || `Host ${host.id}`,
        name: getDeviceName(device) || host.hostname || `Host ${host.id}`,
        deviceType: device?.type,
        organization: device?.organization,
        organizationImageUrl: device?.organizationImageUrl,
        organizationImageHash: device?.organizationImageHash,
        osType: device?.osType,
        status: device?.status || 'UNKNOWN',
        lastSeen: device?.lastSeen || device?.last_seen,
        machineId: device?.machineId,
        fleetHostId: host.id,
        tags: (device?.tags ?? []).flatMap(tag => tag.values.map(value => ({ key: tag.key, value }))),
      };
    });

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [hostsQuery.data, devices]);

  return {
    rows,
    hasNextPage: hostsQuery.data?.hasNext ?? false,
    isLoading: hostsQuery.isLoading || isLoadingDevices,
    error: hostsQuery.error?.message ?? devicesError,
  };
}
