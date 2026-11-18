import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { SoftwareOnDeviceFilterInput } from '@/__generated__/softwareDevicesTableQuery.graphql';
import type {
  DeviceStatus,
  SoftwareAutoUpdateStatus,
  SoftwareOnDeviceStatus,
  SoftwareSource,
} from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { autoUpdateFilterLabel } from '../../shared/auto-update-status';
import { type Facet, facetOptions } from '../../shared/facet-options';
import type { ListSelections } from '../../shared/software-list-frame';
import { SOFTWARE_DEVICE_COLUMNS } from './software-devices-columns';
import { SOFTWARE_ON_DEVICE_STATUS } from './software-on-device-status';

/**
 * Software → Devices' funnels (design 1100:444), keyed by the column each sits on: the device's lifecycle status (on
 * the device), the per-device status (on the version, beside its chip), Installed By and Auto-update.
 */
export const SOFTWARE_DEVICE_FILTER_KEYS = [
  SOFTWARE_DEVICE_COLUMNS.device.id,
  SOFTWARE_DEVICE_COLUMNS.softwareVersion.id,
  SOFTWARE_DEVICE_COLUMNS.installedBy.id,
  SOFTWARE_DEVICE_COLUMNS.autoUpdate.id,
] as const;

type SoftwareDeviceFilterKey = (typeof SOFTWARE_DEVICE_FILTER_KEYS)[number];

export type SoftwareDeviceFilterOptions = Record<SoftwareDeviceFilterKey, DataTableFilterOption[]>;

/** Before the facets answer: no options yet. */
export const NO_SOFTWARE_DEVICE_FILTER_OPTIONS: SoftwareDeviceFilterOptions = {
  device: [],
  softwareVersion: [],
  installedBy: [],
  autoUpdate: [],
};

/**
 * The funnels' options from `softwareDeviceFilters`, worded as their cells word them. A facet the backend leaves empty
 * (Fleet paging, where the list applies no filter) offers nothing, so no funnel narrows what the list ignores.
 */
export function softwareDeviceFilterOptions(
  facets: {
    deviceStatuses: Facet;
    statuses: Facet;
    installedBy: Facet;
    autoUpdateStatuses: Facet;
  },
  /** The list's filter: its ticked values stay offered at a count of 0. */
  ticked: SoftwareOnDeviceFilterInput | null = null,
): SoftwareDeviceFilterOptions {
  return {
    // The server's word for a lifecycle status: the funnel lists what the devices are in, as the devices list does.
    device: facetOptions(facets.deviceStatuses, () => undefined, ticked?.deviceStatuses ?? []),
    softwareVersion: facetOptions(
      facets.statuses,
      status => presentationFor(SOFTWARE_ON_DEVICE_STATUS, status)?.label,
      ticked?.statuses ?? [],
    ),
    installedBy: facetOptions(
      facets.installedBy,
      source => presentationFor(SOFTWARE_SOURCE_LABEL, source),
      ticked?.installedBy ?? [],
    ),
    autoUpdate: facetOptions(facets.autoUpdateStatuses, autoUpdateFilterLabel, ticked?.autoUpdateStatuses ?? []),
  };
}

export function toSoftwareOnDeviceFilter(
  selections: ListSelections,
  tagIds: readonly string[],
): SoftwareOnDeviceFilterInput | null {
  const deviceStatuses = selections.device ?? [];
  const statuses = selections.softwareVersion ?? [];
  const installedBy = selections.installedBy ?? [];
  const autoUpdate = selections.autoUpdate ?? [];
  if (deviceStatuses.length + statuses.length + installedBy.length + autoUpdate.length + tagIds.length === 0) {
    return null;
  }
  return {
    ...(deviceStatuses.length > 0 && { deviceStatuses: deviceStatuses as DeviceStatus[] }),
    ...(statuses.length > 0 && { statuses: statuses as SoftwareOnDeviceStatus[] }),
    ...(installedBy.length > 0 && { installedBy: installedBy as SoftwareSource[] }),
    ...(autoUpdate.length > 0 && { autoUpdateStatuses: autoUpdate as SoftwareAutoUpdateStatus[] }),
    ...(tagIds.length > 0 && { deviceTagIds: [...tagIds] }),
  };
}
