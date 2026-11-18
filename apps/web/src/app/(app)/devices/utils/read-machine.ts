'use client';

import type { deviceFields_machine$key } from '@/__generated__/deviceFields_machine.graphql';
import type { Device } from '../types/device.types';
import { machineToDevice } from './device-transform';

/** Maps a device connection's edges to `Device` rows, skipping null edges. */
export function readMachineEdges(
  edges: ReadonlyArray<{ readonly node?: deviceFields_machine$key | null } | null | undefined> | null | undefined,
): Device[] {
  return (edges ?? []).flatMap(edge => (edge?.node ? [machineToDevice(edge.node)] : []));
}

/**
 * The scrolled list's edges: each row with the viewer's unread notifications about it and the server's outdated-client
 * flag, which only that list selects.
 */
export function readListedMachineEdges(
  edges:
    | ReadonlyArray<
        | {
            readonly node?:
              | (deviceFields_machine$key & {
                  readonly unreadNotificationCount: number;
                  readonly clientOutdated: boolean;
                })
              | null;
          }
        | null
        | undefined
      >
    | null
    | undefined,
): Device[] {
  return (edges ?? []).flatMap(edge =>
    edge?.node
      ? [
          {
            ...machineToDevice(edge.node),
            unreadNotificationCount: edge.node.unreadNotificationCount,
            clientOutdated: edge.node.clientOutdated,
          },
        ]
      : [],
  );
}
