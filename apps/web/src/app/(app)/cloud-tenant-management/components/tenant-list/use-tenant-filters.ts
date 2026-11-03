'use client';

import {
  accessStateTag,
  providerMark,
  type TenantsTableFilters,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql } from 'react-relay';
import type {
  DirectoryConnectionFilterInput,
  useTenantFiltersQuery,
} from '@/__generated__/useTenantFiltersQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { DirectoryAccessState, DirectoryLicenseFilter, DirectoryProvider } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { type FacetRow, useSeenLabels, withSelected } from '@/lib/facet-options';
import { licenseFilterLabel } from '../../utils/tenant-presentation';
import type { TenantSelections } from './tenants-filter';

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

/**
 * The answer's options, then each ticked value it left out at zero (`withSelected`). `labelOf` names both, given the
 * answer's own label where there is one.
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
 * An enum funnel's names: a member this build knows reads as the list's own table, offered or not. One it doesn't know
 * keeps the server's name (the backend shipped it first), and a value no answer carried (a hand-edited URL) its raw
 * text, which never reaches a table, so an inherited key such as `toString` cannot answer for it.
 */
function enumLabel<T extends string>(members: Record<string, T>, name: (value: T) => string) {
  return (value: string, served?: string): string => {
    const member = knownValue(members, value);
    return member ? name(member) : (served ?? value);
  };
}

/**
 * What each funnel offers. Never suspends: the previous options stay on screen until the next answer lands.
 * `selections` are the funnels' ticks, `filter` the query's narrowing of them.
 */
export function useTenantFilters(
  search: string,
  filter: DirectoryConnectionFilterInput | null,
  selections: TenantSelections,
  enabled: boolean,
) {
  const { data, isLoading } = useNonSuspendingQuery<useTenantFiltersQuery>(
    tenantFiltersQuery,
    { search: search || null, filter, list: true },
    enabled,
  );
  const facets = data.directoryConnectionFilters;
  const seen = useSeenLabels(facets);
  // An id (a customer) takes the server's name, or the last one it gave.
  const options: TenantsTableFilters['options'] = {
    tenant: toOptions(
      facets?.providers ?? [],
      selections.tenant,
      enumLabel(DirectoryProvider, value => providerMark(value).label),
    ),
    customer: toOptions(
      facets?.customers ?? [],
      selections.customer,
      (value, served) => served ?? seen('customers', value) ?? value,
    ),
    licenses: toOptions(
      facets?.licenses ?? [],
      selections.licenses,
      enumLabel(DirectoryLicenseFilter, licenseFilterLabel),
    ),
    access: toOptions(
      facets?.accessStates ?? [],
      selections.access,
      enumLabel(DirectoryAccessState, value => accessStateTag(value).label),
    ),
  };
  // Only the first read: later ones keep the funnels live on the previous options.
  return { options, pending: !enabled || (isLoading && !facets) };
}
