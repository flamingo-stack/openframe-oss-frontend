import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { describe, expect, it } from 'vitest';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { sortDevicesLiveFirst, toDeviceOption } from './device-option';

const device = (overrides: Partial<Device>): Device =>
  ({
    machineId: 'm-1',
    hostname: 'VM117272',
    displayName: '',
    nickname: undefined,
    status: 'MANAGED',
    connectivity: 'ONLINE',
    ...overrides,
  }) as Device;

describe('toDeviceOption', () => {
  it('names a device by its hostname, with the customer, its lifecycle and whether it is online underneath', () => {
    expect(toDeviceOption(device({ organization: 'Tech Solutions Co' }))).toEqual({
      label: 'VM117272',
      value: 'm-1',
      description: 'Tech Solutions Co · Managed · Online',
    });
  });

  it('keeps the hostname in view when the name is a nickname, since the log lines carry the hostname', () => {
    expect(toDeviceOption(device({ nickname: 'Demo Machine', organization: 'Tech Solutions Co' }))).toEqual({
      label: 'Demo Machine',
      value: 'm-1',
      description: 'VM117272 · Tech Solutions Co · Managed · Online',
    });
  });

  it('dates an offline record by its last contact, so an old registration reads as one', () => {
    const lastSeen = '2026-10-01T10:00:00.000Z';
    expect(
      toDeviceOption(device({ connectivity: 'OFFLINE', lastSeen, organization: 'Test Customer' })).description,
    ).toBe(`Test Customer · Managed · Offline · ${formatRelativeTime(lastSeen)}`);
  });

  it('reads a legacy ONLINE status as managed and a missing connectivity as offline', () => {
    expect(toDeviceOption(device({ status: 'ONLINE', connectivity: null })).description).toBe('Managed · Offline');
  });

  it('falls back to the machineId when the device has no name at all', () => {
    expect(toDeviceOption(device({ hostname: '' }))).toEqual({
      label: 'm-1',
      value: 'm-1',
      description: 'Managed · Online',
    });
  });
});

describe('sortDevicesLiveFirst', () => {
  it('puts managed online records before managed offline ones and those before the rest, keeping the order within each', () => {
    const sorted = sortDevicesLiveFirst([
      device({ machineId: 'gone', status: 'PENDING_DELETION', connectivity: 'ONLINE' }),
      device({ machineId: 'off-1', connectivity: 'OFFLINE' }),
      device({ machineId: 'live', connectivity: 'ONLINE' }),
      device({ machineId: 'off-2', status: 'OFFLINE', connectivity: null }),
    ]);
    expect(sorted.map(item => item.machineId)).toEqual(['live', 'off-1', 'off-2', 'gone']);
  });
});
