'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useSoftwareFiltersQuery as SoftwareFiltersQueryType } from '@/__generated__/useSoftwareFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type SoftwareFilterOptions, toSoftwareFilterOptions } from '@/graphql/software/software-facets-fields';

/**
 * The Software page's funnels — Version status — as the values that
 * actually occur across the fleet's titles, and how many each.
 *
 * Scoped to nothing: the user's own narrowing is deliberately NOT sent, for the
 * reason `useScheduleDeviceFilters` gives — a funnel answered through its own
 * selection offers one option after the first click. The counts are therefore
 * fleet-wide totals; the narrowed number is the list's to report, from its
 * connection's `filteredCount`.
 */
const softwareFiltersQuery = graphql`
  query useSoftwareFiltersQuery {
    softwareFilters {
      ...softwareFacetsFields_filters
    }
  }
`;

/** **Suspends** — render it inside the same boundary as the list it narrows. */
export function useSoftwareFilters(): SoftwareFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareFiltersQueryType>(
    softwareFiltersQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return toSoftwareFilterOptions(data.softwareFilters);
}
