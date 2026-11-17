import { DEVICE_FILTER_OUTDATED } from '@flamingo-stack/openframe-frontend-core/components/features';

/**
 * The device list's `?sort=` value that puts devices with an outdated OpenFrame client first: where the
 * outdated-client bar's Manage Devices button lands. The only sort the list takes from its address.
 */
export const OUTDATED_FIRST_SORT_PARAM = 'clientOutdated';

export interface DeviceListSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

/** Online first: the order every device list has unless the address asks for outdated first. */
export const DEFAULT_DEVICE_LIST_SORT: DeviceListSort = { field: 'status', direction: 'DESC' };

const OUTDATED_FIRST_SORT: DeviceListSort = { field: 'clientOutdated', direction: 'DESC' };

/** The list order for a `?sort=` value. Anything but {@link OUTDATED_FIRST_SORT_PARAM} is the default order. */
export function parseDeviceListSort(sort: string | null | undefined): DeviceListSort {
  return sort === OUTDATED_FIRST_SORT_PARAM ? OUTDATED_FIRST_SORT : DEFAULT_DEVICE_LIST_SORT;
}

/**
 * Takes the Status funnel's OUTDATED option out of the selected statuses. OUTDATED is not a `DeviceStatus`: the server
 * narrows by it through its own `clientOutdated` input, ANDed with the statuses that are left.
 */
export function splitOutdatedStatus(selected: readonly string[]): { statuses: string[]; clientOutdated: boolean } {
  const statuses = selected.filter(status => status !== DEVICE_FILTER_OUTDATED);
  return { statuses, clientOutdated: statuses.length !== selected.length };
}
