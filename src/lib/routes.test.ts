import { describe, expect, it } from 'vitest';
import { MINGO_DIALOG_PARAM, mingoDialogLink, withMingoDialog } from './routes';

/**
 * `withMingoDialog` writes the URL that `history.replaceState` puts in the address
 * bar verbatim — no router normalizes it afterwards. So what it preserves is the
 * contract: other params, the fragment, and the trailing slash the static export's
 * file host needs to resolve a reload.
 */
describe('withMingoDialog', () => {
  it('adds the param to a bare path and to one that already has a query', () => {
    expect(withMingoDialog('/dashboard', 'd-1')).toBe('/dashboard?mingoDialog=d-1');
    expect(withMingoDialog('/devices/details?id=m-1', 'd-1')).toBe('/devices/details?id=m-1&mingoDialog=d-1');
  });

  it('replaces an existing value rather than appending a second one', () => {
    expect(withMingoDialog('/dashboard?mingoDialog=old', 'new')).toBe('/dashboard?mingoDialog=new');
  });

  it('removes the param on null, and drops the `?` when nothing else is left', () => {
    expect(withMingoDialog('/dashboard?mingoDialog=d-1', null)).toBe('/dashboard');
    expect(withMingoDialog('/devices/details?id=m-1&mingoDialog=d-1', null)).toBe('/devices/details?id=m-1');
    expect(withMingoDialog('/dashboard', null)).toBe('/dashboard');
  });

  it('preserves the fragment', () => {
    // Real case: the help-center ticket deep link carries `#ticket-<id>`, and
    // opening Mingo on that page must not scroll the user somewhere else.
    expect(withMingoDialog('/help-center/tickets?ticket=t-1#ticket-t-1', 'd-1')).toBe(
      '/help-center/tickets?ticket=t-1&mingoDialog=d-1#ticket-t-1',
    );
    expect(withMingoDialog('/dashboard#section', null)).toBe('/dashboard#section');
  });

  it('preserves a trailing slash', () => {
    // Why this matters under `output: 'export'`: see the `withMingoDialog` JSDoc.
    expect(withMingoDialog('/dashboard/', 'd-1')).toBe('/dashboard/?mingoDialog=d-1');
  });

  it('encodes the id instead of pasting it into the query', () => {
    expect(withMingoDialog('/dashboard', 'a b&c=1')).toBe('/dashboard?mingoDialog=a+b%26c%3D1');
  });
});

describe('the canonical Mingo dialog deep link', () => {
  it('shares the drawer resting URL', () => {
    // The chat has no route of its own, so the shareable shape is the drawer's own
    // param on a fixed landing page — a pasted link adopts on arrival with nothing
    // rendered in between.
    expect(mingoDialogLink('d-1')).toBe('/dashboard?mingoDialog=d-1');
    expect(mingoDialogLink('a b&c=1')).toBe('/dashboard?mingoDialog=a+b%26c%3D1');
    expect(MINGO_DIALOG_PARAM).toBe('mingoDialog');
  });
});
