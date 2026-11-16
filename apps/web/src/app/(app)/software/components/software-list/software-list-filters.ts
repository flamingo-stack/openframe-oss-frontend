import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import type { SoftwareFilterInput } from '@/__generated__/softwareListTableQuery.graphql';
import { OsType, type SoftwareAutoUpdateStatus, type SoftwareSource } from '@/generated/schema-enums';
import { AUTO_UPDATE_FILTER_OPTIONS } from '../shared/auto-update-status';
import type { ListSelections } from '../shared/software-list-frame';
import { SOFTWARE_LIST_COLUMNS } from './software-list-columns';

/** The All Software funnels, keyed by the column each sits on — also their URL params. */
export const SOFTWARE_LIST_FILTER_KEYS = [
  SOFTWARE_LIST_COLUMNS.os.id,
  SOFTWARE_LIST_COLUMNS.engine.id,
  SOFTWARE_LIST_COLUMNS.autoUpdate.id,
] as const;

/**
 * Fixed options, not the `softwareFilters` facets: those come back empty on Fleet paging (stage/prod), while the
 * funnels themselves are applied there by the read model. The price is no per-option counts.
 */
export const SOFTWARE_LIST_FILTER_OPTIONS: Record<(typeof SOFTWARE_LIST_FILTER_KEYS)[number], DataTableFilterOption[]> =
  {
    os: Object.values(OsType).map(os => ({ id: os, value: os, label: getOSLabel(os) })),
    engine: Object.entries(SOFTWARE_SOURCE_LABEL).map(([source, label]) => ({ id: source, value: source, label })),
    autoUpdate: AUTO_UPDATE_FILTER_OPTIONS,
  };

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
