'use client';

import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  DirectoryUserFilterInput,
  useUserFiltersQuery as UserFiltersQueryType,
} from '@/__generated__/useUserFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { userStatusTag } from '../../utils/user-presentation';

/**
 * The Users list's funnels — Customer (by tenant) and Status — with how many users each option matches.
 *
 * Unlike `useSoftwareActionFilters` this sends the list's own narrowing: `directoryUserFilters` counts each block
 * under every filter but its own (contract §1), so a funnel keeps its options after the first tick.
 */
const userFiltersQuery = graphql`
  query useUserFiltersQuery($search: String, $filter: DirectoryUserFilterInput) {
    directoryUserFilters(search: $search, filter: $filter) {
      tenants {
        value
        label
        count
      }
      statuses {
        value
        label
        count
      }
    }
  }
`;

export interface UserFilterOptions {
  tenants: DataTableFilterOption[];
  statuses: DataTableFilterOption[];
}

type Facet = ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;

function toOptions(facet: Facet, labelFor?: (value: string) => string): DataTableFilterOption[] {
  return facet.map(option => ({
    id: option.value,
    label: labelFor?.(option.value) ?? option.label,
    value: option.value,
    count: option.count,
  }));
}

/** **Suspends** — render it inside the same boundary as the list it narrows. */
export function useUserFilters(search: string, filter: DirectoryUserFilterInput | null): UserFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<UserFiltersQueryType>(
    userFiltersQuery,
    { search: search || null, filter },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const facets = data.directoryUserFilters;
  return {
    // The tenant's own name, and "OpenFrame" for users added here: the server's labels.
    tenants: toOptions(facets.tenants),
    statuses: toOptions(facets.statuses, value => userStatusTag(value).label),
  };
}
