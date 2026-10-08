import { describe, expect, it } from 'vitest';
import { machineIdsFromParams, TROUBLESHOOTING_DEVICE_LIMIT } from './troubleshooting-params';

describe('machineIdsFromParams', () => {
  it('reads no device as the whole tenant, never as an empty list', () => {
    expect(machineIdsFromParams([])).toBeUndefined();
    expect(machineIdsFromParams(['', '  '])).toBeUndefined();
  });

  it('trims and de-duplicates the picked ids, keeping their order', () => {
    expect(machineIdsFromParams([' b ', 'a', 'b', 'a '])).toEqual(['b', 'a']);
  });

  it('caps the list at the API limit', () => {
    const ids = Array.from({ length: TROUBLESHOOTING_DEVICE_LIMIT + 5 }, (_, index) => `m-${index}`);
    expect(machineIdsFromParams(ids)).toHaveLength(TROUBLESHOOTING_DEVICE_LIMIT);
  });
});
