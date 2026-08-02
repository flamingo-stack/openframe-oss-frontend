'use client';

import { readInlineData } from 'relay-runtime';
import type { deviceFields_machine$key } from '@/__generated__/deviceFields_machine.graphql';
import { deviceFieldsFragment } from '@/graphql/devices/device-fields';
import type { Device } from '../types/device.types';
import { machineToDevice } from './device-transform';

/**
 * Reads a `deviceFields_machine` spread off a device edge and flattens it to the
 * `Device` the shared tables render. Module-private — callers work in edges.
 */
function readMachine(ref: deviceFields_machine$key): Device {
  return machineToDevice(readInlineData(deviceFieldsFragment, ref));
}

/** Maps a device connection's edges to `Device` rows, skipping null edges. */
export function readMachineEdges(
  edges: ReadonlyArray<{ readonly node?: deviceFields_machine$key | null } | null | undefined> | null | undefined,
): Device[] {
  return (edges ?? []).flatMap(edge => (edge?.node ? [readMachine(edge.node)] : []));
}
