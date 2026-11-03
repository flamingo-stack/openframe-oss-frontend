'use client';

import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  DirectoryUserFilterInput,
  useUserFiltersQuery as UserFiltersQueryType,
} from '@/__generated__/useUserFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type FacetRow, useSeenLabels, withSelected } from '@/lib/facet-options';
import { userStatusTag } from '../../utils/user-presentation';
import { unnamedLicenseLabel, type UserSelections } from './users-filter';

/**
 * The Users list's funnels — Customer, Status, and Licences on a customer's tab — with how many users
 * each option matches.
 *
 * Unlike `useSoftwareActionFilters` this sends the list's own narrowing: `directoryUserFilters` counts each block
 * under every filter but its own (contract §1), so a funnel keeps its options after the first tick.
 */
const userFiltersQuery = graphql`
  query useUserFiltersQuery($organizationId: ID, $search: String, $filter: DirectoryUserFilterInput) {
    directoryUserFilters(organizationId: $organizationId, search: $search, filter: $filter) {
      customers {
        value
        label
        count
      }
      statuses {
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

export interface UserFilterOptions {
  customers: DataTableFilterOption[];
  statuses: DataTableFilterOption[];
  licenses: DataTableFilterOption[];
}

/**
 * The answer's options, then each ticked value it left out at zero (`withSelected`, contract §1). `labelOf` names
 * both, given the answer's own label where there is one.
 */
function toOptions(
  facet: readonly FacetRow[],
  selected: readonly string[],
  labelOf: (value: string, served?: string) => string,
): DataTableFilterOption[] {
  return withSelected(
    facet.map(({ value, label, count }) => ({ id: value, label: labelOf(value, label), value, count })),
    selected,
    value => ({ id: value, label: labelOf(value), value, count: 0 }),
  );
}

/**
 * **Suspends** — render it inside the same boundary as the list it narrows. `selections` are the funnels' ticks,
 * `filter` the query's narrowing of them.
 */
export function useUserFilters(
  organizationId: string | undefined,
  search: string,
  filter: DirectoryUserFilterInput | null,
  selections: UserSelections,
): UserFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<UserFiltersQueryType>(
    userFiltersQuery,
    { organizationId: organizationId ?? null, search: search || null, filter },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const facets = data.directoryUserFilters;
  const seen = useSeenLabels(facets);
  return {
    // One option per active customer; empty on a customer's own tab (contract §11.2).
    customers: toOptions(
      facets.customers,
      selections.customer,
      (value, served) => served ?? seen('customers', value) ?? value,
    ),
    statuses: toOptions(facets.statuses, selections.status, value => userStatusTag(value).label),
    // The product name per SKU, and the server's word for "no licence".
    licenses: toOptions(
      facets.licenses,
      selections.license,
      (value, served) => served ?? seen('licenses', value) ?? unnamedLicenseLabel(value),
    ),
  };
}
