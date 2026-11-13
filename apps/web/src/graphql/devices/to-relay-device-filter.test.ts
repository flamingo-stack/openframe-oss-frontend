import { afterEach, describe, expect, it } from 'vitest';
import { setManagedStatusSupported } from '@/lib/device-status-support';
import { toRelayDeviceFilter } from './to-relay-device-filter';

describe('toRelayDeviceFilter', () => {
  it('drops a directory value from the URL that the schema does not know', () => {
    const filter = toRelayDeviceFilter({
      directorySources: ['MICROSOFT_365', 'NOPE'],
      userLinks: ['SHARED', 'nope'],
    });

    expect(filter?.directorySources).toEqual(['MICROSOFT_365']);
    expect(filter?.userLinks).toEqual(['SHARED']);
  });

  it('leaves out a directory filter that is not set: with tenant-management-v2 off the input has no such field', () => {
    const filter = toRelayDeviceFilter({ statuses: ['ONLINE'] });

    expect(filter).not.toHaveProperty('directorySources');
    expect(filter).not.toHaveProperty('userLinks');
  });

  it('keeps a set filter set, as an empty list, when it is empty or none of its values is known', () => {
    const filter = toRelayDeviceFilter({ statuses: [], deviceTypes: ['NOPE'], userLinks: ['nope'] });

    expect(filter?.statuses).toEqual([]);
    expect(filter?.deviceTypes).toEqual([]);
    expect(filter?.userLinks).toEqual([]);
  });
});

describe('toRelayDeviceFilter, the MANAGED status', () => {
  afterEach(() => setManagedStatusSupported(null));

  it('sends MANAGED with the legacy ONLINE / OFFLINE to a backend that has MANAGED', () => {
    setManagedStatusSupported(true);
    expect(toRelayDeviceFilter({ statuses: ['MANAGED', 'PENDING_DELETION'] })?.statuses).toEqual([
      'MANAGED',
      'ONLINE',
      'OFFLINE',
      'PENDING_DELETION',
    ]);
  });

  it('never sends MANAGED to a backend without it, nor before the answer is known', () => {
    for (const supported of [false, null]) {
      setManagedStatusSupported(supported);
      expect(toRelayDeviceFilter({ statuses: ['MANAGED'] })?.statuses).toEqual(['ONLINE', 'OFFLINE']);
    }
  });

  it('passes connectivity, its unknown values dropped, and leaves it out when unset', () => {
    expect(toRelayDeviceFilter({ connectivity: ['ONLINE', 'nope'] })?.connectivity).toEqual(['ONLINE']);
    expect(toRelayDeviceFilter({ statuses: ['PENDING'] })).not.toHaveProperty('connectivity');
  });
});
