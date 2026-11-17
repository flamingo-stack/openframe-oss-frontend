'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useSoftwareDeviceFiltersQuery as SoftwareDeviceFiltersQueryType } from '@/__generated__/useSoftwareDeviceFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type SoftwareDeviceFilterOptions, softwareDeviceFilterOptions } from './software-device-filters';

/**
 * Software → Devices' funnels as the values that occur on this title's devices, and how many each. Scoped to the
 * title only, for the reason `useSoftwareActionFilters` gives: a funnel answered through its own selection offers one
 * option after the first click.
 */
const softwareDeviceFiltersQuery = graphql`
  query useSoftwareDeviceFiltersQuery($softwareId: ID!) {
    softwareDeviceFilters(softwareId: $softwareId) {
      statuses {
        value
        label
        count
      }
      installedBy {
        value
        label
        count
      }
      autoUpdateStatuses {
        value
        label
        count
      }
    }
  }
`;

/** **Suspends**: render it inside the same boundary as the list it narrows. */
export function useSoftwareDeviceFilters(softwareId: string): SoftwareDeviceFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareDeviceFiltersQueryType>(
    softwareDeviceFiltersQuery,
    { softwareId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return softwareDeviceFilterOptions(data.softwareDeviceFilters);
}
