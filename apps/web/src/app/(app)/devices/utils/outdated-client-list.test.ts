import { describe, expect, it } from 'vitest';
import { DEFAULT_DEVICE_LIST_SORT, parseDeviceListSort, splitOutdatedStatus } from './outdated-client-list';

describe('splitOutdatedStatus', () => {
  it('takes OUTDATED out of the statuses and flags it', () => {
    expect(splitOutdatedStatus(['ONLINE', 'OUTDATED'])).toEqual({ statuses: ['ONLINE'], clientOutdated: true });
    expect(splitOutdatedStatus(['OUTDATED'])).toEqual({ statuses: [], clientOutdated: true });
  });

  it('leaves a selection without OUTDATED as it is', () => {
    expect(splitOutdatedStatus(['ONLINE', 'OFFLINE'])).toEqual({
      statuses: ['ONLINE', 'OFFLINE'],
      clientOutdated: false,
    });
    expect(splitOutdatedStatus([])).toEqual({ statuses: [], clientOutdated: false });
  });
});

describe('parseDeviceListSort', () => {
  it('puts outdated clients first for clientOutdated, and is online-first for anything else', () => {
    expect(parseDeviceListSort('clientOutdated')).toEqual({ field: 'clientOutdated', direction: 'DESC' });
    for (const value of ['', 'status', 'hostname', null, undefined]) {
      expect(parseDeviceListSort(value)).toEqual(DEFAULT_DEVICE_LIST_SORT);
    }
  });
});
