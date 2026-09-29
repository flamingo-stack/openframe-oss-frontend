import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, readInlineData } from 'react-relay';
import type { softwareFacetsFields_filters$key } from '@/__generated__/softwareFacetsFields_filters.graphql';
import { SOFTWARE_VERSION_STATUS_LABEL } from '@/app/(app)/software/components/shared/software-version-status';
import { presentationFor } from '@/lib/exhaustive-map';

/**
 * The facet shape of a `SoftwareFilters` field — the fleet-wide `softwareFilters`
 * and a device's `deviceSoftwareFilters`. One selection for both, read by
 * `toSoftwareFilterOptions` below, so the two surfaces' funnel cannot drift.
 *
 * Only `versionStatuses` is read: the table carries no Source column, and
 * `severities` would feed a single `minSeverity` cut-off rather than a set, so
 * a multi-select funnel cannot say what it means — and the scanner does not
 * rate the CVEs it reports, so that facet has answered empty on every stand.
 */
export const softwareFacetsFieldsFragment = graphql`
  fragment softwareFacetsFields_filters on SoftwareFilters @inline {
    versionStatuses {
      value
      label
      count
    }
  }
`;

/** The Software table's funnel, as `DataTable` takes it. */
export interface SoftwareFilterOptions {
  versionStatuses: DataTableFilterOption[];
}

type Facet = ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;

/**
 * A value no title has is not offered: the option has no disabled form, and a
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

/** A `SoftwareFilters` answer as the table's funnel takes it. */
export function toSoftwareFilterOptions(ref: softwareFacetsFields_filters$key): SoftwareFilterOptions {
  const facets = readInlineData(softwareFacetsFieldsFragment, ref);
  return {
    versionStatuses: toOptions(facets.versionStatuses, value => presentationFor(SOFTWARE_VERSION_STATUS_LABEL, value)),
  };
}
