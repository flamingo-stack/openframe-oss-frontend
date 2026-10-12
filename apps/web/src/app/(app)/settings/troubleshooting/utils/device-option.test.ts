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
    status: 'ONLINE',
    ...overrides,
  }) as Device;

describe('toDeviceOption', () => {
  it('names a device by its hostname, with the customer and the status underneath', () => {
    expect(toDeviceOption(device({ organization: 'Tech Solutions Co' }))).toEqual({
      label: 'VM117272',
      value: 'm-1',
      description: 'Tech Solutions Co · Online',
    });
  });

  it('keeps the hostname in view when the name is a nickname, since the log lines carry the hostname', () => {
    expect(toDeviceOption(device({ nickname: 'Demo Machine', organization: 'Tech Solutions Co' }))).toEqual({
      label: 'Demo Machine',
      value: 'm-1',
      description: 'VM117272 · Tech Solutions Co · Online',
    });
  });

  it('dates an offline record by its last contact, so an old registration reads as one', () => {
    const lastSeen = '2026-10-01T10:00:00.000Z';
    expect(toDeviceOption(device({ status: 'OFFLINE', lastSeen, organization: 'Test Customer' })).description).toBe(
      `Test Customer · Offline · ${formatRelativeTime(lastSeen)}`,
    );
  });

  it('falls back to the machineId when the device has no name at all', () => {
    expect(toDeviceOption(device({ hostname: '' }))).toEqual({ label: 'm-1', value: 'm-1', description: 'Online' });
  });
});

describe('sortDevicesLiveFirst', () => {
  it('puts online records before offline ones and those before pending deletion, keeping the order within each', () => {
    const sorted = sortDevicesLiveFirst([
      device({ machineId: 'gone', status: 'PENDING_DELETION' }),
      device({ machineId: 'off-1', status: 'OFFLINE' }),
      device({ machineId: 'live', status: 'ONLINE' }),
      device({ machineId: 'off-2', status: 'OFFLINE' }),
    ]);
    expect(sorted.map(item => item.machineId)).toEqual(['live', 'off-1', 'off-2', 'gone']);
  });
});
