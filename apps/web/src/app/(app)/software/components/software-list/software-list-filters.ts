import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption, FilterGroup } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import type { SoftwareFilterInput } from '@/__generated__/softwareListTableQuery.graphql';
import { OsType, type SoftwareAutoUpdateStatus, SoftwareSource } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { autoUpdateFilterLabel } from '../shared/auto-update-status';
import type { ListSelections } from '../shared/software-list-frame';
import { SOFTWARE_LIST_COLUMNS } from './software-list-columns';

/** The All Software funnels, keyed by the column each sits on — also their URL params. */
export const SOFTWARE_LIST_FILTER_KEYS = [
  SOFTWARE_LIST_COLUMNS.os.id,
  SOFTWARE_LIST_COLUMNS.engine.id,
  SOFTWARE_LIST_COLUMNS.autoUpdate.id,
] as const;

/** Each funnel's options (`useSoftwareListFilters`), keyed as `SOFTWARE_LIST_FILTER_KEYS`. */
export type SoftwareListFilterOptions = Record<(typeof SOFTWARE_LIST_FILTER_KEYS)[number], DataTableFilterOption[]>;

/** Before the facets answer: no options yet. */
export const NO_SOFTWARE_LIST_FILTER_OPTIONS: SoftwareListFilterOptions = { os: [], engine: [], autoUpdate: [] };

/** Every system: `softwareFilters` has no OS facet, so these are not counted. */
const OS_FILTER_OPTIONS: DataTableFilterOption[] = Object.values(OsType).map(os => ({
  id: os,
  value: os,
  label: getOSLabel(os),
}));

type Facet = ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;

/**
 * A value no title has is not offered, nor one the column draws as the empty mark (`labelFor` null: Unmanaged, Needs
 * adoption). The label is the cell's word, the server's for a value this build does not know.
 */
function toOptions(facet: Facet, labelFor: (value: string) => string | null | undefined): DataTableFilterOption[] {
  return facet.flatMap(option => {
    const label = labelFor(option.value);
    if (option.count <= 0 || label === null) return [];
    return [{ id: option.value, value: option.value, label: label ?? option.label, count: option.count }];
  });
}

/** The ENGINE cell's word: none for a title installed by hand. */
function engineLabel(source: string): string | null | undefined {
  return source === SoftwareSource.UNMANAGED ? null : presentationFor(SOFTWARE_SOURCE_LABEL, source);
}

/**
 * The funnels' options from `softwareFilters`. The backend answers them from the read model and leaves them empty on
 * Fleet paging (stage/prod), where `softwares` applies none of these funnels, so a funnel is offered only where it
 * narrows the list. OS has no facet of its own: it goes with the other two.
 */
export function softwareListFilterOptions(facets: {
  sources: Facet;
  autoUpdateStatuses: Facet;
}): SoftwareListFilterOptions {
  const answered = facets.sources.length > 0 || facets.autoUpdateStatuses.length > 0;
  return {
    os: answered ? OS_FILTER_OPTIONS : [],
    engine: toOptions(facets.sources, engineLabel),
    autoUpdate: toOptions(facets.autoUpdateStatuses, autoUpdateFilterLabel),
  };
}

/** The funnels' ticks as `softwares(filter:)` takes them — null when nothing is ticked. */
export function toSoftwareFilter(selections: ListSelections): SoftwareFilterInput | null {
  const os = selections.os ?? [];
  const engine = selections.engine ?? [];
  const autoUpdate = selections.autoUpdate ?? [];
  if (os.length === 0 && engine.length === 0 && autoUpdate.length === 0) return null;
  return {
    ...(os.length > 0 && { osTypes: os as OsType[] }),
    ...(engine.length > 0 && { sources: engine as SoftwareSource[] }),
    ...(autoUpdate.length > 0 && { autoUpdateStatuses: autoUpdate as SoftwareAutoUpdateStatus[] }),
  };
}

/** The same funnels for a narrow content area, where their columns are hidden: the filter window's groups. */
export function softwareListFilterGroups(options: SoftwareListFilterOptions): FilterGroup[] {
  return (
    [
      [SOFTWARE_LIST_COLUMNS.os, options.os],
      [SOFTWARE_LIST_COLUMNS.engine, options.engine],
      [SOFTWARE_LIST_COLUMNS.autoUpdate, options.autoUpdate],
    ] as const
  ).map(([column, groupOptions]) => ({
    id: column.id,
    title: column.header,
    options: groupOptions.map(option => ({ id: String(option.value), label: option.label, count: option.count })),
  }));
}
