'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { SoftwareFilterInput } from '@/__generated__/softwareListTableQuery.graphql';
import type { useSoftwareListFiltersQuery as SoftwareListFiltersQueryType } from '@/__generated__/useSoftwareListFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { facetScope } from '../shared/facet-options';
import { type SoftwareListFilterOptions, softwareListFilterOptions } from './software-list-filters';

/**
 * All Software's Engine and Auto-update funnels as the values that occur across the tenant's titles, and how many
 * each, over the search and the OTHER funnels (`facetScope`): one request, one alias per funnel, so a funnel never
 * narrows its own options to the one already ticked.
 */
const softwareListFiltersQuery = graphql`
  query useSoftwareListFiltersQuery(
    $engineFilter: SoftwareFilterInput
    $autoUpdateFilter: SoftwareFilterInput
    $search: String
  ) {
    engine: softwareFilters(filter: $engineFilter, search: $search) {
      sources {
        value
        label
        count
      }
    }
    autoUpdate: softwareFilters(filter: $autoUpdateFilter, search: $search) {
      autoUpdateStatuses {
        value
        label
        count
      }
    }
  }
`;

/**
 * **Suspends**: render it inside the same boundary as the list it narrows, with the list's deferred filter and search,
 * so a new tick keeps the options on screen while their counts are read.
 */
export function useSoftwareListFilters(
  filter: SoftwareFilterInput | null,
  search: string | null,
): SoftwareListFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareListFiltersQueryType>(
    softwareListFiltersQuery,
    { engineFilter: facetScope(filter, 'sources'), autoUpdateFilter: facetScope(filter, 'autoUpdateStatuses'), search },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return softwareListFilterOptions(
    { sources: data.engine.sources, autoUpdateStatuses: data.autoUpdate.autoUpdateStatuses },
    filter,
  );
}
