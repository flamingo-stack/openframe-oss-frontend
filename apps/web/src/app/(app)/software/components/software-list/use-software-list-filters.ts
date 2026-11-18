'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useSoftwareListFiltersQuery as SoftwareListFiltersQueryType } from '@/__generated__/useSoftwareListFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type SoftwareListFilterOptions, softwareListFilterOptions } from './software-list-filters';

/**
 * All Software's Engine and Auto-update funnels as the values that occur across the tenant's titles, and how many
 * each. Scoped to nothing, for the reason `useSoftwareActionFilters` gives: a funnel answered through its own selection
 * offers one option after the first click.
 */
const softwareListFiltersQuery = graphql`
  query useSoftwareListFiltersQuery {
    softwareFilters {
      sources {
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
export function useSoftwareListFilters(): SoftwareListFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareListFiltersQueryType>(
    softwareListFiltersQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { sources, autoUpdateStatuses } = data.softwareFilters;
  return softwareListFilterOptions({ sources, autoUpdateStatuses });
}
