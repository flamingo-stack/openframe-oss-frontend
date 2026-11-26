import { skipToken, useQuery } from '@tanstack/react-query';
import { graphql } from 'react-relay';
import { fetchQuery } from 'relay-runtime';
import type { devicePackageManagersQuery as DevicePackageManagersQueryType } from '@/__generated__/devicePackageManagersQuery.graphql';
import { PackageManagerState, PackageManagerType } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import type { Instant } from '@/lib/graphql-scalars';
import { getRelayEnvironment } from '@/lib/relay/environment';
import { deviceQueryKeys } from '../utils/query-keys';

/**
 * The package managers of one device as the Agents tab reads them (CU-17tkuw6a84n). Asked on its own, beside the
 * device query, so a backend without the field fails only this request and the device page keeps working.
 */
const devicePackageManagersQuery = graphql`
  query devicePackageManagersQuery($machineId: String!) {
    device(machineId: $machineId) {
      packageManagerDetails {
        type
        state
        managed
        installing
        version
        versionChangedAt
      }
    }
  }
`;

/** One package manager on one device, as the backend reports it. */
export interface DevicePackageManager {
  type: PackageManagerType;
  state: PackageManagerState;
  managed: boolean;
  installing: boolean;
  version: string | null;
  versionChangedAt: Instant | null;
}

/**
 * A refusal because the field is not in the backend's schema (a backend older than the field). The tenant's GraphQL
 * router words it `Cannot query field "packageManagerDetails" on type "Machine".`; graphql-java behind it,
 * `Validation error (FieldUndefined@[device/packageManagerDetails]) : Field 'packageManagerDetails' in type 'Machine'
 * is undefined`. Anything else (a timeout, a resolver error, the network) is transient.
 */
export function isFieldMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('FieldUndefined') ||
    /Field '\w+' in type '\w+' is undefined/.test(message) ||
    /Cannot query field "\w+" on type "\w+"/.test(message)
  );
}

/**
 * The device's package managers; `null` when the backend has no such field, so the tab draws no section. A transient
 * failure throws, and the caller keeps what it last had.
 */
export async function fetchDevicePackageManagers(machineId: string): Promise<DevicePackageManager[] | null> {
  try {
    const data = await fetchQuery<DevicePackageManagersQueryType>(
      getRelayEnvironment(),
      devicePackageManagersQuery,
      { machineId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    // A manager or a state this build does not know yet (a newer backend) is left out rather than guessed at.
    return (data?.device?.packageManagerDetails ?? []).flatMap(entry => {
      const type = knownValue(PackageManagerType, entry.type);
      const state = knownValue(PackageManagerState, entry.state);
      if (!type || !state) return [];
      return [
        {
          type,
          state,
          managed: entry.managed,
          installing: entry.installing,
          version: entry.version ?? null,
          versionChangedAt: entry.versionChangedAt ?? null,
        },
      ];
    });
  } catch (error) {
    if (isFieldMissingError(error)) return null;
    throw error;
  }
}

/** How long one answer stays fresh: the agent reports its package managers every 15 minutes. */
const PACKAGE_MANAGERS_STALE_MS = 5 * 60_000;

/**
 * The Agents tab's read of the device's package managers. It is the tab's own query, not part of the device page's
 * poll: the data changes at most once per agent report. A failed refetch keeps the last answer on screen.
 */
export function useDevicePackageManagers(machineId: string | null | undefined) {
  return useQuery({
    queryKey: deviceQueryKeys.packageManagers(machineId ?? ''),
    queryFn: machineId ? () => fetchDevicePackageManagers(machineId) : skipToken,
    staleTime: PACKAGE_MANAGERS_STALE_MS,
    retry: 1,
  });
}
