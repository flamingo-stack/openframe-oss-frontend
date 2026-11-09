'use client';

import { readInlineData } from 'relay-runtime';
import type { deviceDirectoryFields_machine$key } from '@/__generated__/deviceDirectoryFields_machine.graphql';
import type { deviceFields_machine$key } from '@/__generated__/deviceFields_machine.graphql';
import { deviceDirectoryFieldsFragment } from '@/graphql/devices/device-directory-fields';
import type { Device } from '../types/device.types';
import { readListedMachineEdges } from './read-machine';

type DeviceDirectoryCells = Pick<
  Device,
  'directorySources' | 'directoryUserLink' | 'directoryUserName' | 'directoryUserCount'
>;

/** The USER and SOURCES cells of a Devices-list row (`deviceDirectoryFields_machine`). */
export function machineDirectoryToDevice(ref: deviceDirectoryFields_machine$key): DeviceDirectoryCells {
  const machine = readInlineData(deviceDirectoryFieldsFragment, ref);
  return {
    directorySources: machine.directorySources,
    directoryUserLink: machine.directoryUserLink,
    directoryUserName: machine.directoryUserName,
    directoryUserCount: machine.directoryUserIds.length,
  };
}

type DirectoryListedNode = deviceFields_machine$key &
  deviceDirectoryFields_machine$key & { readonly unreadNotificationCount: number };

/** The scrolled list's edges with their USER and SOURCES cells: {@link readListedMachineEdges}'s rows, each merged. */
export function readDirectoryListedMachineEdges(
  edges: ReadonlyArray<{ readonly node?: DirectoryListedNode | null } | null | undefined> | null | undefined,
): Device[] {
  return (edges ?? []).flatMap(edge => {
    const node = edge?.node;
    return node
      ? readListedMachineEdges([{ node }]).map(device => ({ ...device, ...machineDirectoryToDevice(node) }))
      : [];
  });
}
