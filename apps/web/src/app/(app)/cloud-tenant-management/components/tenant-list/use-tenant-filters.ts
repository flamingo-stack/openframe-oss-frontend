'use client';

import type { TenantsTableFilters } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql } from 'react-relay';
import type {
  DirectoryConnectionFilterInput,
  useTenantFiltersQuery,
} from '@/__generated__/useTenantFiltersQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';

// Each option counts the connections it would match under the search and the other funnels; zero counts are left out.
const tenantFiltersQuery = graphql`
  query useTenantFiltersQuery($search: String, $filter: DirectoryConnectionFilterInput, $list: Boolean!) {
    directoryConnectionFilters(search: $search, filter: $filter) @include(if: $list) {
      providers {
        value
        label
        count
      }
      customers {
        value
        label
        count
      }
      accessStates {
        value
        label
        count
      }
      licenses {
        value
        label
        count
      }
    }
  }
`;

const toOptions = (
  options: readonly { readonly value: string; readonly label: string; readonly count: number }[] | undefined,
): DataTableFilterOption[] => (options ?? []).map(({ value, label, count }) => ({ id: value, label, value, count }));

/** What each funnel offers. Never suspends: the previous options stay on screen until the next answer lands. */
export function useTenantFilters(search: string, filter: DirectoryConnectionFilterInput | null, enabled: boolean) {
  const { data, isLoading } = useNonSuspendingQuery<useTenantFiltersQuery>(
    tenantFiltersQuery,
    { search: search || null, filter, list: true },
    enabled,
  );
  const facets = data.directoryConnectionFilters;
  const options: TenantsTableFilters['options'] = {
    tenant: toOptions(facets?.providers),
    customer: toOptions(facets?.customers),
    licenses: toOptions(facets?.licenses),
    access: toOptions(facets?.accessStates),
  };
  // Only the first read: later ones keep the funnels live on the previous options.
  return { options, pending: !enabled || (isLoading && !facets) };
}
