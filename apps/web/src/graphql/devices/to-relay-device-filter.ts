import type { DeviceFilterInput } from '@flamingo-stack/openframe-frontend-core/components/features';
import { DeviceStatus, DeviceType, DirectorySource, DirectoryUserLink } from '@/generated/schema-enums';
import { knownValues } from '@/lib/exhaustive-map';

/** The enum-typed shape the generated Relay operations expect for `DeviceFilterInput`. */
export interface RelayDeviceFilter {
  statuses?: DeviceStatus[] | null;
  deviceTypes?: DeviceType[] | null;
  osTypes?: string[] | null;
  organizationIds?: string[] | null;
  tagKeys?: string[] | null;
  tagValues?: string[] | null;
  directorySources?: DirectorySource[] | null;
  userLinks?: DirectoryUserLink[] | null;
}

/** An unset filter stays null; a set one keeps its known values, and stays set (`[]`) when none of them is. */
function knownOrNull<T extends string>(values: Record<string, T>, selected: readonly string[] | undefined): T[] | null {
  return selected == null ? null : knownValues(values, selected);
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
    statuses: knownOrNull(DeviceStatus, filter.statuses),
    deviceTypes: knownOrNull(DeviceType, filter.deviceTypes),
    osTypes: filter.osTypes ?? null,
    organizationIds: filter.organizationIds ?? null,
    tagKeys: filter.tagKeys ?? null,
    tagValues: filter.tagValues ?? null,
    // Absent, not null, when unset: with `tenant-management-v2` off the backend's DeviceFilterInput has neither field,
    // and it refuses an unknown input key whatever its value, which would fail every device-filtered query.
    ...(filter.directorySources != null && {
      directorySources: knownValues(DirectorySource, filter.directorySources),
    }),
    ...(filter.userLinks != null && { userLinks: knownValues(DirectoryUserLink, filter.userLinks) }),
  };
}
