'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useDeviceSoftwareFiltersQuery as DeviceSoftwareFiltersQueryType } from '@/__generated__/useDeviceSoftwareFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type SoftwareFilterOptions, toSoftwareFilterOptions } from '@/graphql/software/software-facets-fields';

/**
 * The device Software tab's funnels — Version status — as the values
 * that actually occur among this machine's titles, and how many each: the
 * page's facets (`softwareFilters`) scoped to one device.
 *
 * Scoped to the device and to nothing else: the user's own narrowing is
 * deliberately NOT sent, for the reason `useScheduleDeviceFilters` gives — a
 * funnel answered through its own selection offers one option after the first
 * click.
 */
const deviceSoftwareFiltersQuery = graphql`
  query useDeviceSoftwareFiltersQuery($machineId: String!) {
    deviceSoftwareFilters(machineId: $machineId) {
      ...softwareFacetsFields_filters
    }
  }
`;

/** **Suspends** — render it inside the same boundary as the list it narrows. */
export function useDeviceSoftwareFilters(machineId: string): SoftwareFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<DeviceSoftwareFiltersQueryType>(
    deviceSoftwareFiltersQuery,
    { machineId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return toSoftwareFilterOptions(data.deviceSoftwareFilters);
}
