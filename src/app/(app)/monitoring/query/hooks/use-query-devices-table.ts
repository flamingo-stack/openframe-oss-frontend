import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fleetApiClient } from '@/lib/fleet-api-client';
import { DEVICE_ENRICHMENT_FILTER } from '../../../devices/constants/device-statuses';
import { useAllDevices } from '../../../devices/hooks/use-all-devices';
import { indexDevicesByFleetHostId } from '../../../devices/utils/device-action-utils';
import type { QueryDeviceRow } from '../types/query-device-row';

const QUERY_HOSTS_PAGE_SIZE = 100;

/** Fetch all hosts assigned to a query, following Fleet's page-based pagination. */
async function fetchQueryHosts(queryId: number): Promise<Array<{ id: number; hostname: string }>> {
  const allHosts: Array<{ id: number; hostname: string }> = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await fleetApiClient.getQueryHosts(queryId, { page, per_page: QUERY_HOSTS_PAGE_SIZE });
    if (!res.ok) {
      throw new Error(res.error || `Failed to load assigned devices (${res.status})`);
    }
    const hosts = res.data?.hosts ?? [];
    allHosts.push(...hosts);
    // Guard against an infinite loop if the API reports more pages but returns none.
    hasMore = (res.data?.meta?.has_next_results ?? false) && hosts.length > 0;
    page += 1;
  }
  return allHosts;
}

/**
 * Builds the rows for the Query "Assigned Devices" table by merging the query's
 * assigned Fleet hosts with the device registry (deduplicated by Fleet host id,
 * preferring the most recently seen device). Sorted by display name.
 */
export function useQueryDevicesTable(queryId: number | null) {
  // The Fleet hosts assigned to this query (id + hostname only).
  const hostsQuery = useQuery({
    queryKey: ['query-assigned-hosts', queryId],
    queryFn: () => fetchQueryHosts(queryId!),
    enabled: queryId !== null,
  });

  // The full device registry, used to enrich each assigned host with display,
  // organization, OS, status and tag data.
  const {
    devices,
    isLoading: isLoadingDevices,
    error: devicesError,
  } = useAllDevices({ filter: DEVICE_ENRICHMENT_FILTER, enabled: queryId !== null });

  const rows = useMemo<QueryDeviceRow[]>(() => {
    const hosts = hostsQuery.data;
    if (!hosts) return [];

    const deviceByFleetId = indexDevicesByFleetHostId(devices);

    // Merge each assigned host with its device data (falling back to the host's
    // own fields when no matching device exists in the registry).
    const result: QueryDeviceRow[] = hosts.map(host => {
      const device = deviceByFleetId.get(host.id);
      return {
        id: String(host.id),
        hostname: device?.hostname || host.hostname || `Host ${host.id}`,
        displayName: device?.displayName || device?.hostname || host.hostname || `Host ${host.id}`,
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

    result.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return result;
  }, [hostsQuery.data, devices]);

  return {
    rows,
    isLoading: hostsQuery.isLoading || isLoadingDevices,
    error: hostsQuery.error?.message ?? devicesError,
  };
}
