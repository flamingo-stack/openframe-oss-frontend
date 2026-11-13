import {
  type DeviceFilterInput,
  expandDeviceStatuses,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  DeviceConnectivity,
  DeviceStatus,
  DeviceType,
  DirectorySource,
  DirectoryUserLink,
} from '@/generated/schema-enums';
import { isManagedStatusSupported } from '@/lib/device-status-support';
import { knownValues } from '@/lib/exhaustive-map';

/** The enum-typed shape the generated Relay operations expect for `DeviceFilterInput`. */
export interface RelayDeviceFilter {
  statuses?: DeviceStatus[] | null;
  connectivity?: DeviceConnectivity[] | null;
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
 *
 * Statuses are the UI's: MANAGED stands for MANAGED plus the legacy ONLINE / OFFLINE, and goes out as MANAGED only to
 * a backend that has it (`isManagedStatusSupported`).
 */
export function toRelayDeviceFilter(filter: DeviceFilterInput | undefined | null): RelayDeviceFilter | null {
  if (!filter) return null;
  return {
    statuses: knownOrNull(
      DeviceStatus,
      filter.statuses == null ? undefined : expandDeviceStatuses(filter.statuses, isManagedStatusSupported()),
    ),
    // Absent when unset, like the directory fields below.
    ...(filter.connectivity != null && { connectivity: knownValues(DeviceConnectivity, filter.connectivity) }),
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
