'use client';

import type { QueryResultRow } from '@flamingo-stack/openframe-frontend-core';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fleetApiClient } from '@/lib/fleet-api-client';
import { formatDateTime } from '@/lib/format-date';
import { DEVICE_ENRICHMENT_FILTER } from '../../../devices/constants/device-statuses';
import { useAllDevices } from '../../../devices/hooks/use-all-devices';
import type { Device } from '../../../devices/types/device.types';
import { indexDevicesByFleetHostId } from '../../../devices/utils/device-action-utils';
import { getDeviceName } from '../../../devices/utils/device-name';
import { queriesQueryKeys } from '../../hooks/use-queries';
import type { QueryReportResponse } from '../../types/queries.types';

async function fetchQueryReport(queryId: number): Promise<QueryReportResponse> {
  const res = await fleetApiClient.getQueryReport(queryId);
  if (!res.ok || !res.data) {
    throw new Error(res.error || `Failed to load query report (${res.status})`);
  }
  return res.data;
}

// Fleet reports each host under its own name; the registry device behind the host id is
// what every other screen names (nickname first), with the Fleet name as the fallback for
// a host that has no device record. The key is the column header the lib table renders.
function flattenResults(
  results: QueryReportResponse['results'],
  deviceByFleetId: Map<number, Device>,
): QueryResultRow[] {
  return results.map(result => ({
    device: getDeviceName(deviceByFleetId.get(result.host_id)) || result.host_name,
    last_fetched: result.last_fetched ? formatDateTime(result.last_fetched) : '',
    ...result.columns,
  }));
}

export function useQueryReport(queryId: number | null) {
  const query = useQuery({
    queryKey: [...queriesQueryKeys.detail(queryId), 'report'],
    queryFn: queryId === null ? skipToken : () => fetchQueryReport(queryId),
  });

  // The same whole-fleet read the Devices tab on this page makes (react-query dedupes it).
  const { devices } = useAllDevices({ filter: DEVICE_ENRICHMENT_FILTER, enabled: queryId !== null });
  const rows = useMemo(() => {
    if (!query.data?.results) return [];
    return flattenResults(query.data.results, indexDevicesByFleetHostId(devices));
  }, [query.data, devices]);

  return {
    rows,
    reportClipped: query.data?.report_clipped ?? false,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
