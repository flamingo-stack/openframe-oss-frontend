import type { DeviceFilterInput as RelayDeviceFilterInput } from '@/__generated__/addAllDevicesToScheduleMutation.graphql';
import type { deviceSelectorFields_machine$key } from '@/__generated__/deviceSelectorFields_machine.graphql';
import type { ScheduleDeviceCriteriaInput } from '@/__generated__/setScheduleDeviceCriteriaMutation.graphql';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { machineSelectorToDevice } from '@/app/(app)/devices/utils/device-transform';
import type { DeviceSelectorNarrowing } from '@/app/components/shared/device-selector/device-selector.types';
import { criteriaToInput, type ScheduleCriteria } from './schedule-criteria';

/** How many devices each half of the picker loads per page. */
export const DEVICE_PICKER_PAGE_SIZE = 20;

export const EMPTY_NARROWING: DeviceSelectorNarrowing = { columnFilters: [], tags: [] };

/**
 * The criteria dropdowns must offer the whole fleet's dimensions, never just
 * what the rule being written already matches — otherwise picking one customer
 * makes the second unpickable. Module-level so the query key stays stable.
 */
export const UNFILTERED: DeviceFilterInput = {};

/**
 * Turns the picker's narrowing vocabulary into the backend's.
 *
 * The component speaks in table column filters and `key:value` chips because
 * that is what its controls produce; the schedule's device fields take a
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

/**
 * The same filter, in the shape Relay's generated inputs expect.
 *
 * `DeviceFilterInput` is declared twice: the app's hand-written one types the
 * enum fields as plain strings (it feeds REST-ish call sites), while relay-
 * compiler types them as the schema's enums. The values here come from the
 * backend's own facet options, so they ARE members of those enums — the cast
 * states that rather than duplicating the filter builder per operation.
 */
export function toRelayFilter(filter: DeviceFilterInput): RelayDeviceFilterInput {
  return filter as RelayDeviceFilterInput;
}

/**
 * The same story one level up: the editor holds `deviceTypes` as strings, the
 * generated input wants the `DeviceType` union. The values are taken from the
 * `DeviceType` enum in `@/generated/schema-enums` (see `ScheduleCriteriaFields`),
 * so they are members of it — relay-compiler just emits its own copy of the
 * union per operation.
 */
export function toRelayCriteria(criteria: ScheduleCriteria): ScheduleDeviceCriteriaInput {
  return criteriaToInput(criteria) as ScheduleDeviceCriteriaInput;
}
