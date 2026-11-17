import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { SoftwareOnDeviceFilterInput } from '@/__generated__/softwareDevicesTableQuery.graphql';
import type { SoftwareAutoUpdateStatus, SoftwareOnDeviceStatus, SoftwareSource } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { autoUpdateFilterLabel } from '../../shared/auto-update-status';
import { type Facet, facetOptions } from '../../shared/facet-options';
import type { ListSelections } from '../../shared/software-list-frame';
import { SOFTWARE_DEVICE_COLUMNS } from './software-devices-columns';
import { SOFTWARE_ON_DEVICE_STATUS } from './software-on-device-status';

/**
 * Software → Devices' funnels (design 1100:444), keyed by the column each sits on: the per-device status (on the
 * version, beside its chip), Managed By and Auto-update.
 */
export const SOFTWARE_DEVICE_FILTER_KEYS = [
  SOFTWARE_DEVICE_COLUMNS.softwareVersion.id,
  SOFTWARE_DEVICE_COLUMNS.installedBy.id,
  SOFTWARE_DEVICE_COLUMNS.autoUpdate.id,
] as const;

type SoftwareDeviceFilterKey = (typeof SOFTWARE_DEVICE_FILTER_KEYS)[number];

export type SoftwareDeviceFilterOptions = Record<SoftwareDeviceFilterKey, DataTableFilterOption[]>;

/** Before the facets answer: no options yet. */
export const NO_SOFTWARE_DEVICE_FILTER_OPTIONS: SoftwareDeviceFilterOptions = {
  softwareVersion: [],
  installedBy: [],
  autoUpdate: [],
};

/**
 * The funnels' options from `softwareDeviceFilters`, worded as their cells word them. A facet the backend leaves empty
 * (Fleet paging, where the list applies no filter) offers nothing, so no funnel narrows what the list ignores.
 */
export function softwareDeviceFilterOptions(facets: {
  statuses: Facet;
  installedBy: Facet;
  autoUpdateStatuses: Facet;
}): SoftwareDeviceFilterOptions {
  return {
    softwareVersion: facetOptions(facets.statuses, status => presentationFor(SOFTWARE_ON_DEVICE_STATUS, status)?.label),
    installedBy: facetOptions(facets.installedBy, source => presentationFor(SOFTWARE_SOURCE_LABEL, source)),
    autoUpdate: facetOptions(facets.autoUpdateStatuses, autoUpdateFilterLabel),
  };
}

/** The funnels' ticks and the Device Tags window's, as `softwareDevices(filter:)` takes them: null for none. */
export function toSoftwareOnDeviceFilter(
  selections: ListSelections,
  tagIds: readonly string[],
): SoftwareOnDeviceFilterInput | null {
  const statuses = selections.softwareVersion ?? [];
  const installedBy = selections.installedBy ?? [];
  const autoUpdate = selections.autoUpdate ?? [];
  if (statuses.length + installedBy.length + autoUpdate.length + tagIds.length === 0) return null;
  return {
    ...(statuses.length > 0 && { statuses: statuses as SoftwareOnDeviceStatus[] }),
    ...(installedBy.length > 0 && { installedBy: installedBy as SoftwareSource[] }),
    ...(autoUpdate.length > 0 && { autoUpdateStatuses: autoUpdate as SoftwareAutoUpdateStatus[] }),
    ...(tagIds.length > 0 && { deviceTagIds: [...tagIds] }),
  };
}
