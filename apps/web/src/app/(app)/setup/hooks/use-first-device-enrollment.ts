'use client';

import { isDeviceConnected } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useEffect, useState } from 'react';
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { Environment, FetchPolicy } from 'relay-runtime';
import type { firstDeviceEnrollmentRelayQuery as EnrollmentQuery } from '@/__generated__/firstDeviceEnrollmentRelayQuery.graphql';
import { DeviceStatus, SortDirection } from '@/generated/schema-enums';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { firstDeviceEnrollmentRelayQuery } from '@/graphql/onboarding/first-device-enrollment-relay';
import { decodeGlobalId } from '@/lib/relay-id';

/** How often the checklist asks again while the agent installs (2-3 minutes end to end). */
const POLL_MS = 5_000;

// Every status an enrolling or enrolled machine can carry. Deleted, archived and
// decommissioned ones are a previous life of the workspace, not the first device.
// Built when asked, not at module load: whether MANAGED goes out is answered after the app starts.
const enrollmentVariables = () => ({
  filter: toRelayDeviceFilter({
    statuses: [
      DeviceStatus.PENDING,
      DeviceStatus.ACTIVE,
      DeviceStatus.INACTIVE,
      DeviceStatus.MAINTENANCE,
      DeviceStatus.MANAGED,
    ],
  }),
  sort: { field: 'lastSeen', direction: SortDirection.DESC },
});

// `store-and-network`: the mount reads whatever the store already holds and asks
// once; the interval below keeps the store fresh and every reader re-renders
// from it.
const ENROLLMENT_OPTIONS = { fetchPolicy: 'store-and-network' as FetchPolicy };

/**
 * The checklist's stages, each a stamp of the machine's `enrollment`:
 * - `enrolled`          - the machine registered (the node exists).
 * - `connected`         - the agent reached the platform over NATS (`connectedAt`).
 * - `inventoryReceived` - Fleet confirmed the host: inventory is queryable.
 * - `aiReady`           - connected and inventoried, so Mingo can work the
 *                         machine (`enrollment.ready`).
 * A null `enrollment` is a transient read error: the stages stay as they were
 * and the next poll answers (`useFirstDeviceEnrollment` holds them).
 */
export interface EnrollmentStages {
  enrolled: boolean;
  connected: boolean;
  inventoryReceived: boolean;
  aiReady: boolean;
}

export interface FirstDevice {
  /** The device page's id (`routes.devices.details`); null for a record without one. */
  machineId: string | null;
  /**
   * The id its record link (`record://device/<id>`) names it by: the raw part of
   * its global id, as the context picker sends it (`relay-items`), else `machineId`.
   */
  mentionId: string | null;
  /** What the device page would call it: display name, else hostname. */
  name: string;
  /** The agent is connected right now - the "LIVE" tag. */
  online: boolean;
  /** When the machine registered (epoch ms); null when the read had no enrollment. */
  registeredAt: number | null;
  stages: EnrollmentStages;
}

type DeviceNode = NonNullable<NonNullable<EnrollmentQuery['response']['devices']['edges']>[number]>['node'];

/** An `Instant` as epoch ms; null when absent or unreadable. */
function toEpochMs(instant: string | null | undefined): number | null {
  if (!instant) return null;
  const ms = Date.parse(instant);
  return Number.isNaN(ms) ? null : ms;
}

function toFirstDevice(node: DeviceNode | null | undefined): FirstDevice | null {
  if (!node) return null;
  const enrollment = node.enrollment;
  return {
    machineId: node.machineId?.trim() || null,
    mentionId: decodeGlobalId(node.id)?.rawId ?? (node.machineId?.trim() || null),
    name: node.displayName?.trim() || node.hostname?.trim() || 'your device',
    online: isDeviceConnected(node.connectivity),
    registeredAt: toEpochMs(enrollment?.registeredAt),
    stages: {
      enrolled: true,
      connected: enrollment?.connectedAt != null,
      inventoryReceived: enrollment?.inventoryConnectedAt != null,
      aiReady: enrollment?.ready ?? false,
    },
  };
}

/** Two reads of one machine say the same about its enrollment. */
function sameEnrollment(a: FirstDevice, b: FirstDevice | null): boolean {
  return (
    b != null &&
    a.machineId === b.machineId &&
    a.registeredAt === b.registeredAt &&
    a.stages.connected === b.stages.connected &&
    a.stages.inventoryReceived === b.stages.inventoryReceived &&
    a.stages.aiReady === b.stages.aiReady
  );
}

/**
 * The first device, read once from the network: for a handler that needs it
 * at the moment of a click (the tour's chips that open the device's page)
 * rather than a component that renders it.
 */
export async function fetchFirstDevice(environment: Environment): Promise<FirstDevice | null> {
  const data = await fetchQuery<EnrollmentQuery>(environment, firstDeviceEnrollmentRelayQuery, enrollmentVariables(), {
    fetchPolicy: 'store-or-network',
  }).toPromise();
  return toFirstDevice(data?.devices.edges?.[0]?.node);
}

/**
 * The first device's enrollment progress, re-read every `POLL_MS` while
 * `polling` is on. Suspends on first read: mount it under the wizard's Suspense.
 */
export function useFirstDeviceEnrollment(polling: boolean): FirstDevice | null {
  const environment = useRelayEnvironment();
  const data = useLazyLoadQuery<EnrollmentQuery>(
    firstDeviceEnrollmentRelayQuery,
    enrollmentVariables(),
    ENROLLMENT_OPTIONS,
  );

  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => {
      // Refresh the store; the `useLazyLoadQuery` above re-renders from it. A
      // failed poll is retried by the next tick, so its error is not surfaced.
      fetchQuery<EnrollmentQuery>(environment, firstDeviceEnrollmentRelayQuery, enrollmentVariables(), {
        fetchPolicy: 'network-only',
      }).subscribe({ error: () => undefined });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [environment, polling]);

  const node = data.devices.edges?.[0]?.node;
  const read = toFirstDevice(node);
  const enrollmentRead = node?.enrollment != null;

  // A null enrollment is a read error, not a step back (the stamps are never
  // cleared): the same machine keeps the stages of its last good read, so one
  // failed poll neither brings the "not connected" notice back nor locks
  // Continue again. Kept as state set while rendering, React's pattern for
  // remembering the previous render's value.
  const [lastGood, setLastGood] = useState<FirstDevice | null>(null);
  if (read && enrollmentRead && !sameEnrollment(read, lastGood)) setLastGood(read);

  if (read && !enrollmentRead && lastGood && lastGood.machineId === read.machineId) {
    return { ...read, registeredAt: lastGood.registeredAt, stages: lastGood.stages };
  }
  return read;
}
