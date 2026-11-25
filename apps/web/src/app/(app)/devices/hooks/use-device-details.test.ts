/**
 * Pins how the id of the user who added a device travels from the GraphQL node
 * to the device the page renders, and how an OS below Fleet's minimum decides
 * whether Fleet is read at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceGraphQlNode, ToolConnection } from '../types/device.types';
import { createDevice, fetchDeviceDetails, fetchDeviceUnsupportedTools } from './use-device-details';

const api = vi.hoisted(() => ({ fetchDeviceNode: vi.fn() }));
const relay = vi.hoisted(() => ({ fetchQuery: vi.fn() }));
const fleet = vi.hoisted(() => ({ getHost: vi.fn() }));

// The real modules carry graphql tags, which need the Relay babel plugin vitest does not run: the device query layer
// is mocked, and this file's own graphql tag is stubbed (the query document is not under test).
vi.mock('../queries/devices-api', () => ({ fetchDeviceNode: api.fetchDeviceNode }));
vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('relay-runtime', () => ({ fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay/environment', () => ({ getRelayEnvironment: () => ({}) }));
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

/** The unsupported-tools query answers with this result (a resolved payload or a refusal). */
function unsupportedToolsAnswer(result: Promise<unknown>) {
  relay.fetchQuery.mockReturnValue({ toPromise: () => result });
}

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
    relay.fetchQuery.mockReset();
    fleet.getHost.mockReset();
    fleet.getHost.mockResolvedValue({ ok: true, data: { host: { id: 23, hostname: 'workstation-23' } } });
  });

  it('skips the Fleet read and marks the source unsupported when no Fleet is live', async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [] });
    unsupportedToolsAnswer(Promise.resolve({ device: { unsupportedTools: FLEET_UNSUPPORTED } }));

    const device = await fetchDeviceDetails('machine-1');

    expect(device.sources).toEqual({ fleet: 'skipped-unsupported' });
    expect(device.unsupportedTools).toEqual(FLEET_UNSUPPORTED);
    expect(fleet.getHost).not.toHaveBeenCalled();
  });

  it('still reads a live Fleet, so a Fleet that runs keeps its data on screen', async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [liveFleet] });
    unsupportedToolsAnswer(Promise.resolve({ device: { unsupportedTools: FLEET_UNSUPPORTED } }));

    const device = await fetchDeviceDetails('machine-1');

    expect(fleet.getHost).toHaveBeenCalledWith(23, expect.anything());
    expect(device.sources).toEqual({ fleet: 'ok' });
    expect(device.unsupportedTools).toEqual(FLEET_UNSUPPORTED);
  });

  it("keeps today's pending state when nothing is unsupported (unknown version, or a backend without the field)", async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [] });
    unsupportedToolsAnswer(Promise.resolve({ device: { unsupportedTools: [] } }));

    const device = await fetchDeviceDetails('machine-1');

    expect(device.sources).toEqual({ fleet: 'skipped-pending' });
    expect(device.unsupportedTools).toEqual([]);
  });

  it('asks for the device and its unsupported tools side by side', async () => {
    api.fetchDeviceNode.mockResolvedValue({ ...NODE, toolConnections: [] });
    unsupportedToolsAnswer(Promise.resolve({ device: { unsupportedTools: [] } }));

    await fetchDeviceDetails('machine-1');

    expect(api.fetchDeviceNode).toHaveBeenCalledWith('machine-1');
    expect(relay.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { machineId: 'machine-1' },
      {
        fetchPolicy: 'network-only',
      },
    );
  });
});

describe('fetchDeviceUnsupportedTools', () => {
  beforeEach(() => relay.fetchQuery.mockReset());

  it('returns the reported entries, asked network-only for this machine', async () => {
    const entry = { toolType: 'FLEET_MDM', minOsVersion: '13.0', osVersion: '11.7.10' };
    unsupportedToolsAnswer(Promise.resolve({ device: { unsupportedTools: [entry] } }));

    await expect(fetchDeviceUnsupportedTools('machine-1')).resolves.toEqual([entry]);
    expect(relay.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { machineId: 'machine-1' },
      { fetchPolicy: 'network-only' },
    );
  });

  it('reads a refused query (a backend without the field) as none', async () => {
    unsupportedToolsAnswer(
      Promise.reject(new Error("Validation error: Field 'unsupportedTools' in type 'Machine' is undefined")),
    );

    await expect(fetchDeviceUnsupportedTools('machine-1')).resolves.toEqual([]);
  });

  it('reads a missing device as none', async () => {
    unsupportedToolsAnswer(Promise.resolve({ device: null }));

    await expect(fetchDeviceUnsupportedTools('machine-1')).resolves.toEqual([]);
  });
});
