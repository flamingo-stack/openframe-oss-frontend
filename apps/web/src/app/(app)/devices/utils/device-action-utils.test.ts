import { describe, expect, it } from 'vitest';
import type { Device, ToolConnection } from '../types/device.types';
import { canRunRemoteActions, getDeviceActionAvailability, isDeviceOnline } from './device-action-utils';

const liveMesh: ToolConnection = {
  id: 'tc-1',
  machineId: 'm-1',
  toolType: 'MESHCENTRAL',
  agentToolId: 'node/abc',
  status: 'online',
};

function device(overrides: Partial<Device>): Device {
  return {
    id: 'd-1',
    machineId: 'm-1',
    hostname: 'host',
    displayName: 'host',
    status: 'MANAGED',
    connectivity: 'ONLINE',
    toolConnections: [liveMesh],
    ...overrides,
  } as Device;
}

describe('isDeviceOnline', () => {
  it('reads connectivity only; null (never reported) is offline', () => {
    expect(isDeviceOnline('ONLINE')).toBe(true);
    expect(isDeviceOnline('online')).toBe(true);
    expect(isDeviceOnline('OFFLINE')).toBe(false);
    expect(isDeviceOnline(null)).toBe(false);
    expect(isDeviceOnline(undefined)).toBe(false);
  });
});

describe('canRunRemoteActions', () => {
  it.each([
    ['MANAGED', 'ONLINE', true],
    // A device not migrated yet still carries the legacy status: it is managed too.
    ['ONLINE', 'ONLINE', true],
    ['OFFLINE', 'ONLINE', true],
    ['MANAGED', 'OFFLINE', false],
    ['MANAGED', null, false],
    // The backend refuses dispatch to a device that is still connecting, online or not.
    ['PENDING', 'ONLINE', false],
    ['PENDING_DELETION', 'ONLINE', false],
    ['DELETED', 'ONLINE', false],
    ['ARCHIVED', 'ONLINE', false],
  ])('%s + %s → %s', (status, connectivity, expected) => {
    expect(canRunRemoteActions({ status, connectivity })).toBe(expected);
  });
});

describe('getDeviceActionAvailability', () => {
  it('enables the remote actions and Run Script on a managed device online right now', () => {
    const availability = getDeviceActionAvailability(device({}));
    expect(availability).toMatchObject({
      remoteShellEnabled: true,
      remoteControlEnabled: true,
      manageFilesEnabled: true,
      rebootEnabled: true,
      runScriptEnabled: true,
      isOnline: true,
    });
  });

  it('disables them on a pending device even while it is online', () => {
    const availability = getDeviceActionAvailability(device({ status: 'PENDING' }));
    expect(availability).toMatchObject({
      remoteShellEnabled: false,
      rebootEnabled: false,
      runScriptEnabled: false,
      isOnline: true,
    });
  });

  it('disables them on a managed device that is offline, whatever its old status said', () => {
    const availability = getDeviceActionAvailability(device({ status: 'ONLINE', connectivity: 'OFFLINE' }));
    expect(availability).toMatchObject({ remoteShellEnabled: false, runScriptEnabled: false, isOnline: false });
  });

  it('keeps the remote actions off without a live MeshCentral connection, Run Script on', () => {
    const availability = getDeviceActionAvailability(device({ toolConnections: [] }));
    expect(availability).toMatchObject({ remoteShellEnabled: false, runScriptEnabled: true });
  });
});
