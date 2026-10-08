import { describe, expect, it } from 'vitest';
import { pickedIdsFromParams, TROUBLESHOOTING_PICK_LIMIT } from './troubleshooting-params';

describe('pickedIdsFromParams', () => {
  it('reads nothing picked as the whole tenant, never as an empty list', () => {
    expect(pickedIdsFromParams([])).toBeUndefined();
    expect(pickedIdsFromParams(['', '  '])).toBeUndefined();
  });

  it('trims and de-duplicates the picked ids, keeping their order', () => {
    expect(pickedIdsFromParams([' b ', 'a', 'b', 'a '])).toEqual(['b', 'a']);
  });

  it('caps the list at the API limit', () => {
    const ids = Array.from({ length: TROUBLESHOOTING_PICK_LIMIT + 5 }, (_, index) => `id-${index}`);
    expect(pickedIdsFromParams(ids)).toHaveLength(TROUBLESHOOTING_PICK_LIMIT);
  });
});
