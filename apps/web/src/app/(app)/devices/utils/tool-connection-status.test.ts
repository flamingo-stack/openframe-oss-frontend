import { describe, expect, it } from 'vitest';
import type { Device, ToolConnection } from '../types/device.types';
import { fleetTimestampMs } from './fleet-timestamp';
import {
  getExpectedAgentTypes,
  getToolConnectionDisplayStatus,
  getToolConnectionState,
  isDeviceStillConnecting,
} from './tool-connection-status';

function conn(overrides: Partial<ToolConnection>): ToolConnection {
  return {
    id: 'tc-1',
    machineId: 'm-1',
    toolType: 'MESHCENTRAL',
    agentToolId: 'node/abc',
    status: 'CONNECTED',
    ...overrides,
  };
}

function device(overrides: Partial<Device>): Device {
  return {
    id: 'd-1',
    machineId: 'm-1',
    hostname: 'host',
    displayName: 'host',
    status: 'ONLINE',
    ...overrides,
  } as Device;
}

describe('getToolConnectionState', () => {
  it('is pending when there is no connection row', () => {
    expect(getToolConnectionState(undefined)).toBe('pending');
    expect(getToolConnectionState(null)).toBe('pending');
  });

  it('is pending when agentToolId is empty', () => {
    expect(getToolConnectionState(conn({ agentToolId: '' }))).toBe('pending');
  });

  it('is disconnected for DISCONNECTED and ERROR rows regardless of case', () => {
    expect(getToolConnectionState(conn({ status: 'DISCONNECTED' }))).toBe('disconnected');
    expect(getToolConnectionState(conn({ status: 'disconnected' }))).toBe('disconnected');
    expect(getToolConnectionState(conn({ status: 'ERROR' }))).toBe('disconnected');
  });

  it('is live for CONNECTED and for probe-enriched lowercase statuses', () => {
    expect(getToolConnectionState(conn({ status: 'CONNECTED' }))).toBe('live');
    expect(getToolConnectionState(conn({ status: 'online' }))).toBe('live');
    expect(getToolConnectionState(conn({ status: 'offline' }))).toBe('live');
    expect(getToolConnectionState(conn({ status: 'mia' }))).toBe('live');
  });
});

describe('getToolConnectionDisplayStatus', () => {
  it('renders pending without an id and the probe result with one', () => {
    expect(getToolConnectionDisplayStatus(undefined)).toBe('pending');
    expect(getToolConnectionDisplayStatus(conn({ agentToolId: '' }))).toBe('pending');
    expect(getToolConnectionDisplayStatus(conn({ status: 'online' }))).toBe('online');
    expect(getToolConnectionDisplayStatus(conn({ status: 'offline' }))).toBe('offline');
  });

  it('renders a torn-down (DISCONNECTED) row as offline, not pending', () => {
    expect(getToolConnectionDisplayStatus(conn({ status: 'DISCONNECTED' }))).toBe('offline');
  });
});

describe('isDeviceStillConnecting', () => {
  const liveFleet = conn({ toolType: 'FLEET_MDM', agentToolId: '23', status: 'online' });
  const liveMesh = conn({ toolType: 'MESHCENTRAL', status: 'online' });

  it('is false when both core tools are live', () => {
    expect(isDeviceStillConnecting(device({ toolConnections: [liveFleet, liveMesh] }))).toBe(false);
  });

  it('is true while either core tool has not registered yet', () => {
    expect(isDeviceStillConnecting(device({ toolConnections: [liveFleet] }))).toBe(true);
    expect(isDeviceStillConnecting(device({ toolConnections: [] }))).toBe(true);
    expect(isDeviceStillConnecting(device({ toolConnections: undefined }))).toBe(true);
  });

  it('is false for a disconnected (torn down) tool — that is offline, not connecting', () => {
    const deadMesh = conn({ toolType: 'MESHCENTRAL', status: 'DISCONNECTED' });
    expect(isDeviceStillConnecting(device({ toolConnections: [liveFleet, deadMesh] }))).toBe(false);
  });

  it('is suppressed on archive-lifecycle records', () => {
    for (const status of ['ARCHIVED', 'DELETED', 'PENDING_DELETION', 'DECOMMISSIONED']) {
      expect(isDeviceStillConnecting(device({ status, toolConnections: [] }))).toBe(false);
    }
  });
});

describe('getExpectedAgentTypes', () => {
  it('expects Fleet and MeshCentral on every tenant, plus the chat app on SaaS', () => {
    expect(getExpectedAgentTypes(device({}), false)).toEqual(['fleetmdm-agent', 'meshcentral-agent']);
    expect(getExpectedAgentTypes(device({}), true)).toEqual(['fleetmdm-agent', 'meshcentral-agent', 'openframe-chat']);
  });

  it('expects nothing on archive-lifecycle records, whatever the case', () => {
    for (const status of ['ARCHIVED', 'DELETED', 'PENDING_DELETION', 'DECOMMISSIONED', 'archived']) {
      expect(getExpectedAgentTypes(device({ status }), true)).toEqual([]);
    }
  });

  it('keeps the slots for a device that is itself still pending', () => {
    expect(getExpectedAgentTypes(device({ status: 'PENDING' }), false)).toHaveLength(2);
  });
});

describe('fleetTimestampMs', () => {
  it('treats missing, unparsable, and Fleet sentinel values as not set', () => {
    expect(fleetTimestampMs(undefined)).toBeNull();
    expect(fleetTimestampMs(null)).toBeNull();
    expect(fleetTimestampMs('')).toBeNull();
    expect(fleetTimestampMs('not-a-date')).toBeNull();
    expect(fleetTimestampMs('0001-01-01T00:00:00Z')).toBeNull();
  });

  it('returns epoch millis for a real timestamp', () => {
    expect(fleetTimestampMs('2026-09-01T15:06:01Z')).toBe(Date.parse('2026-09-01T15:06:01Z'));
  });
});
