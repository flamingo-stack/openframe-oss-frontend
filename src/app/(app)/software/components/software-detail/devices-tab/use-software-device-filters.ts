'use client';

import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useSoftwareDeviceFiltersQuery as SoftwareDeviceFiltersQueryType } from '@/__generated__/useSoftwareDeviceFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { presentationFor } from '@/lib/exhaustive-map';
import { SOFTWARE_ON_DEVICE_STATUS } from './software-on-device-status';

/**
 * The Status funnel's options for one title's Devices tab: the per-device
 * states that actually occur among the machines carrying it, and how many each.
 *
 * Scoped to the title and to nothing else. The user's own narrowing is
 * deliberately NOT sent, for the reason `useScheduleDeviceFilters` gives: a
 * funnel answered through its own selection offers one option after the first
 * click. The counts are therefore per-title totals; the narrowed number is the
 * list's to report, from its connection's `filteredCount`.
 */
const softwareDeviceFiltersQuery = graphql`
  query useSoftwareDeviceFiltersQuery($softwareId: ID!) {
    softwareDeviceFilters(softwareId: $softwareId) {
      statuses {
        value
        label
        count
      }
    }
  }
`;

/** **Suspends** — render it inside the same boundary as the list it narrows. */
export function useSoftwareDeviceFilters(softwareId: string): DataTableFilterOption[] {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareDeviceFiltersQueryType>(
    softwareDeviceFiltersQuery,
    { softwareId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // A state no device is in is not offered: the option has no disabled form,
  // and a tick that narrows the list to nothing is worse than no tick. The
  // label is the app's own — the word the row's chip uses — with the server's
  // as the fallback for a state this build does not know yet.
  return data.softwareDeviceFilters.statuses
    .filter(option => option.count > 0)
    .map(option => ({
      id: option.value,
      label: presentationFor(SOFTWARE_ON_DEVICE_STATUS, option.value)?.label ?? option.label,
      value: option.value,
      count: option.count,
    }));
}
