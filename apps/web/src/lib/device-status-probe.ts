import { fetchQuery } from 'react-relay';
import type { deviceStatusSupportRelayQuery as DeviceStatusSupportQuery } from '@/__generated__/deviceStatusSupportRelayQuery.graphql';
import { deviceStatusSupportRelayQuery } from '@/graphql/devices/device-status-support-relay';
import { setManagedStatusSupported, storeManagedStatusSupport } from '@/lib/device-status-support';
import { getRelayEnvironment } from '@/lib/relay';

/**
 * Asks the backend whether it knows MANAGED: true when the probe answers, false when it refuses the value, null when
 * the request failed for another reason (offline, auth): then nothing is stored and the next load asks again.
 */
export async function probeManagedStatusSupport(): Promise<boolean | null> {
  try {
    const data = await fetchQuery<DeviceStatusSupportQuery>(
      getRelayEnvironment(),
      deviceStatusSupportRelayQuery,
      {},
      { fetchPolicy: 'network-only' },
    ).toPromise();
    return data?.deviceFilters ? true : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return /MANAGED|DeviceStatus|enum/i.test(message) ? false : null;
  }
}

/** Probes and remembers the answer for this tab. An unknown answer reads as "not supported" and is not stored. */
export async function resolveManagedStatusSupport(): Promise<boolean> {
  const answer = await probeManagedStatusSupport();
  if (answer !== null) storeManagedStatusSupport(answer);
  const supported = answer ?? false;
  setManagedStatusSupported(supported);
  return supported;
}
