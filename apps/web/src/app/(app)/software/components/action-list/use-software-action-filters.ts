'use client';

import { PACKAGE_MANAGER_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { SoftwareActionFilterInput } from '@/__generated__/softwareActionsTableQuery.graphql';
import type { useSoftwareActionFiltersQuery as SoftwareActionFiltersQueryType } from '@/__generated__/useSoftwareActionFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { presentationFor } from '@/lib/exhaustive-map';
import { facetScope } from '../shared/facet-options';
import { softwareActionKindLabel } from './software-action-kind';
import { softwareActionStatusLabel } from './software-action-status-tag';

/**
 * The Software Actions list's three funnels — Action / Engine / Status — as the
 * values that actually occur across the tenant's runs, and how many each.
 *
 * The backend counts a facet under the filter it is given, so each funnel is asked with its OWN field left out
 * (`facetScope`): its counts follow the search and the other two funnels, and it still offers every value after
 * the first tick.
 */
const softwareActionFiltersQuery = graphql`
  query useSoftwareActionFiltersQuery(
    $kindsFilter: SoftwareActionFilterInput
    $enginesFilter: SoftwareActionFilterInput
    $statusesFilter: SoftwareActionFilterInput
    $search: String
  ) {
    kinds: softwareActionFilters(filter: $kindsFilter, search: $search) {
      kinds {
        value
        label
        count
      }
    }
    engines: softwareActionFilters(filter: $enginesFilter, search: $search) {
      engines {
        value
        label
        count
      }
    }
    statuses: softwareActionFilters(filter: $statusesFilter, search: $search) {
      statuses {
        value
        label
        count
      }
    }
  }
`;

export interface SoftwareActionFilterOptions {
  actions: DataTableFilterOption[];
  engines: DataTableFilterOption[];
  statuses: DataTableFilterOption[];
}

type Facet = ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;

/**
 * A value no run has is not offered: the option has no disabled form, and a
 * tick that narrows the list to nothing is worse than no tick. The label is the
 * app's own — the word the row shows — with the server's as the fallback for a
 * value this build does not know yet. Read HERE rather than in a shared helper:
 * `relay/unused-fields` only credits a field to the module that touches it.
 */
function toOptions(
  facet: Facet,
  labelFor: (value: string) => string | undefined,
  selected: readonly string[] | null | undefined,
): DataTableFilterOption[] {
  return facet
    .filter(option => option.count > 0 || (selected ?? []).includes(option.value))
    .map(option => ({
      id: option.value,
      label: labelFor(option.value) ?? option.label,
      value: option.value,
      count: option.count,
    }));
}

/**
 * The three funnels' options over the search and the OTHER funnels (`facetScope`): one request, one alias per funnel,
 * so a funnel never narrows its own options to the one already ticked. **Suspends**: pass the list's deferred filter
 * and search, so a new tick keeps the options on screen while their counts are read.
 */
export function useSoftwareActionFilters(
  filter: SoftwareActionFilterInput | null,
  search: string | null,
): SoftwareActionFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareActionFiltersQueryType>(
    softwareActionFiltersQuery,
    {
      kindsFilter: facetScope(filter, 'kinds'),
      enginesFilter: facetScope(filter, 'engines'),
      statusesFilter: facetScope(filter, 'statuses'),
      search,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  return {
    actions: toOptions(data.kinds.kinds, softwareActionKindLabel, filter?.kinds),
    engines: toOptions(data.engines.engines, value => presentationFor(PACKAGE_MANAGER_LABEL, value), filter?.engines),
    statuses: toOptions(data.statuses.statuses, softwareActionStatusLabel, filter?.statuses),
  };
}
