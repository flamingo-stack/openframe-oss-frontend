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

  it('sends null for a directory filter that is not set', () => {
    const filter = toRelayDeviceFilter({ statuses: ['ONLINE'] });

    expect(filter?.directorySources).toBeNull();
    expect(filter?.userLinks).toBeNull();
  });
});
