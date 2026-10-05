'use client';

import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useSoftwareActionFiltersQuery as SoftwareActionFiltersQueryType } from '@/__generated__/useSoftwareActionFiltersQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { presentationFor } from '@/lib/exhaustive-map';
import { PACKAGE_MANAGER_LABEL } from '../shared/package-managers';
import { softwareActionCopy } from '../shared/software-action-copy';
import { softwareActionStatusLabel } from './software-action-status-tag';

/**
 * The Software Actions list's three funnels — Action / Engine / Status — as the
 * values that actually occur across the tenant's runs, and how many each.
 *
 * Scoped to nothing: the user's own narrowing is deliberately NOT sent, for the
 * reason `useScheduleDeviceFilters` gives — the backend counts each facet under
 * the active filters, so a funnel answered through its own selection offers one
 * option after the first click. The counts are therefore list-wide totals; the
 * narrowed number is the list's to report, from its connection's `filteredCount`.
 */
const softwareActionFiltersQuery = graphql`
  query useSoftwareActionFiltersQuery {
    softwareActionFilters {
      actions {
        value
        label
        count
      }
      engines {
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
function toOptions(facet: Facet, labelFor: (value: string) => string | undefined): DataTableFilterOption[] {
  return facet
    .filter(option => option.count > 0)
    .map(option => ({
      id: option.value,
      label: labelFor(option.value) ?? option.label,
      value: option.value,
      count: option.count,
    }));
}

/** **Suspends** — render it inside the same boundary as the list it narrows. */
export function useSoftwareActionFilters(): SoftwareActionFilterOptions {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareActionFiltersQueryType>(
    softwareActionFiltersQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const facets = data.softwareActionFilters;

  return {
    actions: toOptions(facets.actions, value => softwareActionCopy(value)?.verb),
    // Chocolatey is not a manager the forms offer, so the label map has no word
    // for it; the server's own fills in, since the inventory lists what ran.
    engines: toOptions(facets.engines, value => presentationFor(PACKAGE_MANAGER_LABEL, value)),
    statuses: toOptions(facets.statuses, softwareActionStatusLabel),
  };
}
