import type { deviceSelectorFields_machine$key } from '@/__generated__/deviceSelectorFields_machine.graphql';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { machineSelectorToDevice } from '@/app/(app)/devices/utils/device-transform';
import type { DeviceSelectorNarrowing } from './device-selector.types';

/** How many devices each half of a server-driven picker loads per page. */
export const DEVICE_PICKER_PAGE_SIZE = 20;

export const EMPTY_NARROWING: DeviceSelectorNarrowing = { columnFilters: [], tags: [] };

/**
 * Turns the picker's narrowing vocabulary into the backend's.
 *
 * The component speaks in table column filters and `key:value` chips because
 * that is what its controls produce; the owner's device fields take a
 * `DeviceFilterInput`. A plain-text chip (no colon) stays on screen but carries
 * no filter — same as the devices page.
 */
export function narrowingToFilter(narrowing: DeviceSelectorNarrowing): DeviceFilterInput {
  const column = (id: string) => narrowing.columnFilters.find(f => f.id === id)?.value as string[] | undefined;
  const tagPairs = narrowing.tags.flatMap(t => {
    const i = t.indexOf(':');
    return i > 0 ? [{ key: t.slice(0, i), value: t.slice(i + 1) }] : [];
  });

  const filter: DeviceFilterInput = {};
  const statuses = column('status');
  const osTypes = column('os');
  const organizationIds = column('organization');
  if (statuses?.length) filter.statuses = statuses;
  if (osTypes?.length) filter.osTypes = osTypes;
  if (organizationIds?.length) filter.organizationIds = organizationIds;
  if (tagPairs.length) {
    filter.tagKeys = tagPairs.map(t => t.key);
    filter.tagValues = tagPairs.map(t => t.value);
  }
  return filter;
}

type MachineEdges = ReadonlyArray<
  { readonly node?: deviceSelectorFields_machine$key | null } | null | undefined
> | null;

/** Connection edges → table rows, skipping any dangling (store-evicted) edge. */
export function toDevices(edges: MachineEdges | undefined): Device[] {
  return (edges ?? []).flatMap(edge => (edge?.node ? [machineSelectorToDevice(edge.node)] : []));
}
