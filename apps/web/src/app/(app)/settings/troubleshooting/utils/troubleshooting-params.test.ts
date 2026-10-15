import { describe, expect, it } from 'vitest';
import {
  pickedIdsFromParams,
  picksWithoutUnknown,
  TROUBLESHOOTING_PICK_LIMIT,
  unknownPickFromErrors,
} from './troubleshooting-params';

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

describe('unknownPickFromErrors', () => {
  it('maps the not-found codes to the picker that holds the id', () => {
    expect(unknownPickFromErrors([{ message: 'Organization not found: x', code: 'ORGANIZATION_NOT_FOUND' }])).toEqual({
      param: 'customer',
      message: 'Organization not found: x',
    });
    expect(unknownPickFromErrors([{ message: 'Machine not found: m', code: 'DEVICE_NOT_FOUND' }])).toEqual({
      param: 'device',
      message: 'Machine not found: m',
    });
  });

  it('leaves every other failure to the generic load error', () => {
    expect(unknownPickFromErrors([])).toBeNull();
    expect(unknownPickFromErrors([{ message: 'boom', code: 'INTERNAL_ERROR' }])).toBeNull();
    expect(unknownPickFromErrors([{ message: 'Organization not found: x', code: null }])).toBeNull();
  });
});

describe('picksWithoutUnknown', () => {
  it('drops only the id the message names, keeping the other picks', () => {
    expect(picksWithoutUnknown(['org-1', 'bad', 'org-2'], 'Organization not found: bad')).toEqual(['org-1', 'org-2']);
  });

  it('matches a picked id that came with stray whitespace', () => {
    expect(picksWithoutUnknown([' bad ', 'org-1'], 'Organization not found: bad')).toEqual(['org-1']);
  });

  it('prefers the longest id the message ends with', () => {
    expect(picksWithoutUnknown(['b', 'ab'], 'Machine not found: ab')).toEqual(['b']);
  });

  it('clears the whole filter when no pick is named', () => {
    expect(picksWithoutUnknown(['org-1', 'org-2'], 'Organization not found')).toEqual([]);
  });
});
