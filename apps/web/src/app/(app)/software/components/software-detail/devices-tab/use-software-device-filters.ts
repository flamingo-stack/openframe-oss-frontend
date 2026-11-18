'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { SoftwareOnDeviceFilterInput } from '@/__generated__/softwareDevicesTableQuery.graphql';
import type { useSoftwareDeviceFiltersQuery as SoftwareDeviceFiltersQueryType } from '@/__generated__/useSoftwareDeviceFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { facetScope } from '../../shared/facet-options';
import { type SoftwareDeviceFilterOptions, softwareDeviceFilterOptions } from './software-device-filters';

/**
 * Software → Devices' funnels as the values that occur on this title's devices, and how many each, over the search,
 * the Device Tags and the OTHER funnels (`facetScope`): one request, one alias per funnel, so a funnel never narrows
 * its own options to the one already ticked.
 */
const softwareDeviceFiltersQuery = graphql`
  query useSoftwareDeviceFiltersQuery(
    $softwareId: ID!
    $deviceFilter: SoftwareOnDeviceFilterInput
    $versionFilter: SoftwareOnDeviceFilterInput
    $installedByFilter: SoftwareOnDeviceFilterInput
    $autoUpdateFilter: SoftwareOnDeviceFilterInput
    $search: String
  ) {
    device: softwareDeviceFilters(softwareId: $softwareId, filter: $deviceFilter, search: $search) {
      deviceStatuses {
        value
        label
        count
      }
    }
    version: softwareDeviceFilters(softwareId: $softwareId, filter: $versionFilter, search: $search) {
      statuses {
        value
        label
        count
      }
    }
    installedBy: softwareDeviceFilters(softwareId: $softwareId, filter: $installedByFilter, search: $search) {
      installedBy {
        value
        label
        count
      }
    }
    autoUpdate: softwareDeviceFilters(softwareId: $softwareId, filter: $autoUpdateFilter, search: $search) {
      autoUpdateStatuses {
        value
        label
        count
      }
    }
  }
`;

/**
 * **Suspends**: pass the list's deferred filter and search, so a new tick keeps the options on screen while their
 * counts are read.
 */
export function useSoftwareDeviceFilters(
  softwareId: string,
  filter: SoftwareOnDeviceFilterInput | null,
  search: string | null,
): SoftwareDeviceFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareDeviceFiltersQueryType>(
    softwareDeviceFiltersQuery,
    {
      softwareId,
      deviceFilter: facetScope(filter, 'deviceStatuses'),
      versionFilter: facetScope(filter, 'statuses'),
      installedByFilter: facetScope(filter, 'installedBy'),
      autoUpdateFilter: facetScope(filter, 'autoUpdateStatuses'),
      search,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return softwareDeviceFilterOptions(
    {
      deviceStatuses: data.device.deviceStatuses,
      statuses: data.version.statuses,
      installedBy: data.installedBy.installedBy,
      autoUpdateStatuses: data.autoUpdate.autoUpdateStatuses,
    },
    filter,
  );
}
