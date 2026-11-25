/**
 * Pins how the id of the user who added a device travels from the GraphQL node
 * to the device the page renders, and how an OS below Fleet's minimum decides
 * whether Fleet is read at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceGraphQlNode, ToolConnection } from '../types/device.types';
import { createDevice, fetchDeviceDetails } from './use-device-details';

const api = vi.hoisted(() => ({ fetchDeviceNode: vi.fn(), fetchDeviceUnsupportedTools: vi.fn() }));
const fleet = vi.hoisted(() => ({ getHost: vi.fn() }));

// The real modules carry graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('../queries/devices-api', () => ({ fetchDeviceNode: api.fetchDeviceNode }));
vi.mock('./device-unsupported-tools', () => ({ fetchDeviceUnsupportedTools: api.fetchDeviceUnsupportedTools }));
vi.mock('@/lib/fleet-api-client', () => ({ fleetApiClient: fleet }));
vi.mock('@/lib/feature-flags', () => ({ featureFlags: { softwareManagement: { enabled: () => false } } }));
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

describe('fetchDeviceDetails on an OS below the Fleet minimum', () => {
  const FLEET_UNSUPPORTED = [{ toolType: 'FLEET_MDM', minOsVersion: '13.0', osVersion: '11.7.10' }];
  const liveFleet: ToolConnection = {
    id: 'tc-fleet',
    machineId: 'machine-1',
    toolType: 'FLEET_MDM',
    agentToolId: '23',
    status: 'CONNECTED',
  };

  beforeEach(() => {
    api.fetchDeviceNode.mockReset();
    api.fetchDeviceUnsupportedTools.mockReset();
    fleet.getHost.mockReset();
    fleet.getHost.mockResolvedValue({ ok: true, data: { host: { id: 23, hostname: 'workstation-23' } } });
  });

  it('skips the Fleet read and marks the source unsupported when no Fleet is live', async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [] });
    api.fetchDeviceUnsupportedTools.mockResolvedValue(FLEET_UNSUPPORTED);

    const device = await fetchDeviceDetails('machine-1');

    expect(device.sources).toEqual({ fleet: 'skipped-unsupported' });
    expect(device.unsupportedTools).toEqual(FLEET_UNSUPPORTED);
    expect(fleet.getHost).not.toHaveBeenCalled();
  });

  it('still reads a live Fleet, so a Fleet that runs keeps its data on screen', async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [liveFleet] });
    api.fetchDeviceUnsupportedTools.mockResolvedValue(FLEET_UNSUPPORTED);

    const device = await fetchDeviceDetails('machine-1');

    expect(fleet.getHost).toHaveBeenCalledWith(23, expect.anything());
    expect(device.sources).toEqual({ fleet: 'ok' });
    expect(device.unsupportedTools).toEqual(FLEET_UNSUPPORTED);
  });

  it("keeps today's pending state when nothing is unsupported (unknown version, or a backend without the field)", async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [] });
    api.fetchDeviceUnsupportedTools.mockResolvedValue([]);

    const device = await fetchDeviceDetails('machine-1');

    expect(device.sources).toEqual({ fleet: 'skipped-pending' });
    expect(device.unsupportedTools).toEqual([]);
  });

  it('asks for the device and its unsupported tools side by side', async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [] });
    api.fetchDeviceUnsupportedTools.mockResolvedValue([]);

    await fetchDeviceDetails('machine-1');

    expect(api.fetchDeviceNode).toHaveBeenCalledWith('machine-1');
    expect(api.fetchDeviceUnsupportedTools).toHaveBeenCalledWith('machine-1');
  });
});
