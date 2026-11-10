import { describe, expect, it } from 'vitest';
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
