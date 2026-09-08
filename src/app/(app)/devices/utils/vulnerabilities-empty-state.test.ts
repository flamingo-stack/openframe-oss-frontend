import { describe, expect, it } from 'vitest';
import type { Device, DeviceDataSources, ToolConnection } from '../types/device.types';
import { getVulnerabilitiesEmptyReason } from './vulnerabilities-empty-state';

function fleetConn(vulnerabilitiesUpdatedAt: string | null | undefined): ToolConnection {
  return {
    id: 'tc-1',
    machineId: 'm-1',
    toolType: 'FLEET_MDM',
    agentToolId: '23',
    status: 'online',
    vulnerabilitiesUpdatedAt,
  };
}

function device(overrides: Partial<Device> & { fleet?: DeviceDataSources['fleet'] }): Device {
  const { fleet, ...rest } = overrides;
  return {
    id: 'd-1',
    machineId: 'm-1',
    hostname: 'host',
    displayName: 'host',
    status: 'ONLINE',
    ...(fleet && { sources: { fleet } }),
    ...rest,
  } as Device;
}

describe('getVulnerabilitiesEmptyReason', () => {
  it('reports the fleet fan-out outcome first', () => {
    expect(getVulnerabilitiesEmptyReason(device({ fleet: 'error' }))).toBe('error');
    expect(getVulnerabilitiesEmptyReason(device({ fleet: 'skipped-disconnected' }))).toBe('disconnected');
    expect(getVulnerabilitiesEmptyReason(device({ fleet: 'skipped-pending' }))).toBe('collecting');
  });

  it('is collecting until the host completes a software inventory scan', () => {
    expect(getVulnerabilitiesEmptyReason(device({ fleet: 'ok' }))).toBe('collecting');
    expect(getVulnerabilitiesEmptyReason(device({ fleet: 'ok', software_updated_at: '0001-01-01T00:00:00Z' }))).toBe(
      'collecting',
    );
  });

  it('is scan-pending while matching never completed or ran before the current inventory', () => {
    // The exact live case from the BE spec: inventory newer than the last completed run.
    const spec = device({
      fleet: 'ok',
      software_updated_at: '2026-09-01T15:06:01Z',
      toolConnections: [fleetConn('2026-09-01T14:31:24Z')],
    });
    expect(getVulnerabilitiesEmptyReason(spec)).toBe('scan-pending');

    const neverMatched = device({
      fleet: 'ok',
      software_updated_at: '2026-09-01T15:06:01Z',
      toolConnections: [fleetConn(null)],
    });
    expect(getVulnerabilitiesEmptyReason(neverMatched)).toBe('scan-pending');
  });

  it('is clean only when the last completed run covered the current inventory', () => {
    const covered = device({
      fleet: 'ok',
      software_updated_at: '2026-09-01T15:06:01Z',
      toolConnections: [fleetConn('2026-09-01T16:00:00Z')],
    });
    expect(getVulnerabilitiesEmptyReason(covered)).toBe('clean');

    const equal = device({
      fleet: 'ok',
      software_updated_at: '2026-09-01T15:06:01Z',
      toolConnections: [fleetConn('2026-09-01T15:06:01Z')],
    });
    expect(getVulnerabilitiesEmptyReason(equal)).toBe('clean');
  });

  it('falls back to the timestamp comparison when sources is absent (stale cache shape)', () => {
    const noSources = device({
      software_updated_at: '2026-09-01T15:06:01Z',
      toolConnections: [fleetConn('2026-09-01T16:00:00Z')],
    });
    expect(getVulnerabilitiesEmptyReason(noSources)).toBe('clean');
  });
});
