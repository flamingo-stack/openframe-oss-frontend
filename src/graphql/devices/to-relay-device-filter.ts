import type { DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { DeviceStatus, DeviceType } from '@/generated/schema-enums';

/** The enum-typed shape the generated Relay operations expect for `DeviceFilterInput`. */
export interface RelayDeviceFilter {
  statuses?: DeviceStatus[] | null;
  deviceTypes?: DeviceType[] | null;
  osTypes?: string[] | null;
  organizationIds?: string[] | null;
  tagKeys?: string[] | null;
  tagValues?: string[] | null;
}

function keepKnown<T extends string>(values: string[] | undefined, allowed: Record<string, T>): T[] | undefined {
  if (!values) return undefined;
  const known = new Set<string>(Object.values(allowed));
  return values.filter((value): value is T => known.has(value));
}

/**
 * Narrows the app's string-based device filter to the enum-typed one Relay
 * generates from the schema.
 *
 * A real boundary, not a cast: `statuses` and `deviceTypes` are `DeviceStatus` /
 * `DeviceType` enums server-side, but the app's filter values come from URL
 * query params — arbitrary user input. An unrecognised value is dropped here
 * rather than sent, where it would fail the whole query on a GraphQL enum
 * coercion error and blank the list.
 */
export function toRelayDeviceFilter(filter: DeviceFilterInput | undefined | null): RelayDeviceFilter | null {
  if (!filter) return null;
  return {
    statuses: keepKnown(filter.statuses, DeviceStatus) ?? null,
    deviceTypes: keepKnown(filter.deviceTypes, DeviceType) ?? null,
    osTypes: filter.osTypes ?? null,
    organizationIds: filter.organizationIds ?? null,
    tagKeys: filter.tagKeys ?? null,
    tagValues: filter.tagValues ?? null,
  };
}
