/**
 * Pins how the id of the user who added a device travels from the GraphQL node
 * to the device the page renders.
 */

import { describe, expect, it, vi } from 'vitest';
import type { DeviceGraphQlNode } from '../types/device.types';
import { createDevice } from './use-device-details';

// The real modules carry graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('../queries/devices-api', () => ({ fetchDeviceNode: vi.fn() }));
vi.mock('../utils/device-transform', () => ({ toDeviceTags: () => [] }));
vi.mock('@/lib/fleet-api-client', () => ({ fleetApiClient: {} }));
vi.mock('@/lib/meshcentral/meshcentral-api', () => ({
  getMeshCentralDeviceInfo: vi.fn(),
  parseMeshCentralDeviceStatus: vi.fn(),
  parseMeshCentralLastSeen: vi.fn(),
}));

const NODE: DeviceGraphQlNode = {
  id: 'node-1',
  machineId: 'machine-1',
  hostname: 'workstation-23',
  nickname: null,
  status: 'ONLINE',
};

const toDevice = (node: DeviceGraphQlNode) => createDevice(node, null, null, null, { fleet: 'skipped-pending' });

describe('createDevice', () => {
  it('carries the id of the user who added the device', () => {
    expect(toDevice({ ...NODE, userId: 'user-1' }).addedByUserId).toBe('user-1');
  });

  it.each([null, undefined, ''])('leaves it out for a device enrolled without one (%j)', userId => {
    expect(toDevice({ ...NODE, userId }).addedByUserId).toBeUndefined();
  });
});
