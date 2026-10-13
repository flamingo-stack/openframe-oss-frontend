'use client';

import { useEffect } from 'react';
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { FetchPolicy } from 'relay-runtime';
import type { firstDeviceEnrollmentRelayQuery as EnrollmentQuery } from '@/__generated__/firstDeviceEnrollmentRelayQuery.graphql';
import { DeviceStatus, SortDirection } from '@/generated/schema-enums';
import { firstDeviceEnrollmentRelayQuery } from '@/graphql/onboarding/first-device-enrollment-relay';

/** How often the checklist asks again while the agent installs (2-3 minutes end to end). */
const POLL_MS = 5_000;

// Every status an enrolling or enrolled machine can carry. Deleted, archived and
// decommissioned ones are a previous life of the workspace, not the first device.
const ENROLLMENT_VARIABLES = {
  filter: {
    statuses: [
      DeviceStatus.PENDING,
      DeviceStatus.ACTIVE,
      DeviceStatus.INACTIVE,
      DeviceStatus.MAINTENANCE,
      DeviceStatus.ONLINE,
      DeviceStatus.OFFLINE,
    ],
  },
  sort: { field: 'lastSeen', direction: SortDirection.DESC },
};

// `store-and-network`: the mount reads whatever the store already holds and asks
// once; the interval below keeps the store fresh and every reader re-renders
// from it.
const ENROLLMENT_OPTIONS = { fetchPolicy: 'store-and-network' as FetchPolicy };

/**
 * The checklist's stages, each a stamp of the machine's `enrollment`:
 * - `enrolled`          - the machine registered (the node exists).
 * - `inventoryReceived` - Fleet confirmed the host: inventory is queryable.
 * - `aiReady`           - the agent is connected as well, so Mingo can work the
 *                         machine (`enrollment.ready`).
 * A null `enrollment` is a transient read error: the stages stay as they were
 * and the next poll answers.
 */
export interface EnrollmentStages {
  enrolled: boolean;
  inventoryReceived: boolean;
  aiReady: boolean;
}

export interface FirstDevice {
  /** What the device page would call it: display name, else hostname. */
  name: string;
  /** The agent is connected right now - the "LIVE" tag. */
  online: boolean;
  stages: EnrollmentStages;
}

type DeviceNode = NonNullable<NonNullable<EnrollmentQuery['response']['devices']['edges']>[number]>['node'];

function toFirstDevice(node: DeviceNode | null | undefined): FirstDevice | null {
  if (!node) return null;
  const enrollment = node.enrollment;
  return {
    name: node.displayName?.trim() || node.hostname?.trim() || 'your device',
    online: node.status === DeviceStatus.ONLINE,
    stages: {
      enrolled: true,
      inventoryReceived: enrollment?.inventoryConnectedAt != null,
      aiReady: enrollment?.ready ?? false,
    },
  };
}

/**
 * The first device's enrollment progress, re-read every `POLL_MS` while
 * `polling` is on. Suspends on first read: mount it under the wizard's Suspense.
 */
export function useFirstDeviceEnrollment(polling: boolean): FirstDevice | null {
  const environment = useRelayEnvironment();
  const data = useLazyLoadQuery<EnrollmentQuery>(
    firstDeviceEnrollmentRelayQuery,
    ENROLLMENT_VARIABLES,
    ENROLLMENT_OPTIONS,
  );

  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => {
      // Refresh the store; the `useLazyLoadQuery` above re-renders from it. A
      // failed poll is retried by the next tick, so its error is not surfaced.
      fetchQuery<EnrollmentQuery>(environment, firstDeviceEnrollmentRelayQuery, ENROLLMENT_VARIABLES, {
        fetchPolicy: 'network-only',
      }).subscribe({ error: () => undefined });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [environment, polling]);

  return toFirstDevice(data.devices.edges?.[0]?.node);
}
