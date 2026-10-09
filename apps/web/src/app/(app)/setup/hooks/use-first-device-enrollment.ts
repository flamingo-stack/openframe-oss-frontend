'use client';

import { useEffect } from 'react';
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { FetchPolicy } from 'relay-runtime';
import type { firstDeviceEnrollmentRelayQuery as EnrollmentQuery } from '@/__generated__/firstDeviceEnrollmentRelayQuery.graphql';
import { ConnectionStatus, DeviceStatus, ToolType } from '@/generated/schema-enums';
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
};

// `store-and-network`: the mount reads whatever the store already holds and asks
// once; the interval below keeps the store fresh and every reader re-renders
// from it.
const ENROLLMENT_OPTIONS = { fetchPolicy: 'store-and-network' as FetchPolicy };

/**
 * The checklist's stages, each a fact about the machine the backend already
 * reports. Derived here until the backend exposes them as one field (see the
 * BE spec on first-device enrollment progress):
 * - `enrolled`          - the machine registered (any status).
 * - `inventoryReceived` - Fleet has its inventory (the FLEET_MDM connection is up).
 * - `aiReady`           - the agent Mingo acts through is up as well, so the
 *                         assistant can work the machine.
 */
export interface EnrollmentStages {
  enrolled: boolean;
  inventoryReceived: boolean;
  aiReady: boolean;
}

export interface FirstDevice {
  /** What the device page would call it: display name, else hostname. */
  name: string;
  stages: EnrollmentStages;
}

type DeviceNode = NonNullable<NonNullable<EnrollmentQuery['response']['devices']['edges']>[number]>['node'];

function toFirstDevice(node: DeviceNode | null | undefined): FirstDevice | null {
  if (!node) return null;
  const connections = (node.toolConnections ?? []).filter(connection => connection != null);
  const connected = (toolType: ToolType) =>
    connections.some(
      connection => connection.toolType === toolType && connection.status === ConnectionStatus.CONNECTED,
    );
  const inventoryReceived = connected(ToolType.FLEET_MDM);
  return {
    name: node.displayName?.trim() || node.hostname?.trim() || 'your device',
    stages: {
      enrolled: true,
      inventoryReceived,
      aiReady: inventoryReceived && (connected(ToolType.OPENFRAME_RMM) || connected(ToolType.MESHCENTRAL)),
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
