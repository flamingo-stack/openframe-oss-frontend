import { describe, expect, it } from 'vitest';
import { type MingoUrlSyncInput, resolveMingoUrlSync } from './use-mingo-dialog-url-sync';

/**
 * These pin the ORDER, which is the whole design. Every defect found in review was
 * a tie between "adopt the URL" and "write the URL" that nothing decided: the two
 * running in one commit off the same pre-adopt render, so the write stripped the
 * param the adopt was consuming.
 */
const base: MingoUrlSyncInput = {
  navigated: false,
  urlDialogId: null,
  mirroredDialogId: null,
  mingoGate: 'on',
  canOpenDrawer: true,
  drawerOpen: false,
  activeDialogId: null,
};

describe('resolveMingoUrlSync', () => {
  it('adopts a cold deep link instead of stripping it', () => {
    // The store is still empty on this pass — the projection must not get to run
    // and conclude the URL is stale.
    expect(resolveMingoUrlSync({ ...base, urlDialogId: 'd-1' })).toEqual({ type: 'adopt', dialogId: 'd-1' });
  });

  it('does not re-adopt the id it just wrote', () => {
    expect(
      resolveMingoUrlSync({
        ...base,
        urlDialogId: 'd-1',
        mirroredDialogId: 'd-1',
        drawerOpen: true,
        activeDialogId: 'd-1',
      }),
    ).toEqual({ type: 'none' });
  });

  it('holds an instruction until the flag answers, and adopts once it does', () => {
    const loading = { ...base, urlDialogId: 'd-1', mingoGate: 'loading' as const };
    expect(resolveMingoUrlSync(loading)).toEqual({ type: 'none' });
    expect(resolveMingoUrlSync({ ...loading, mingoGate: 'on' })).toEqual({ type: 'adopt', dialogId: 'd-1' });
  });

  it('holds an instruction while no drawer is mounted', () => {
    // Subscription lock, mid-boot chrome — the drawer comes back, so the link
    // must not be spent on a shell that cannot show it.
    expect(resolveMingoUrlSync({ ...base, urlDialogId: 'd-1', canOpenDrawer: false })).toEqual({ type: 'none' });
  });

  it('strips a param the tenant can never honour', () => {
    // Flag definitively off: no drawer will ever exist here.
    expect(resolveMingoUrlSync({ ...base, urlDialogId: 'd-1', mingoGate: 'off' })).toEqual({
      type: 'write',
      dialogId: null,
    });
  });

  it('writes the open conversation into the URL', () => {
    expect(resolveMingoUrlSync({ ...base, drawerOpen: true, activeDialogId: 'd-1' })).toEqual({
      type: 'write',
      dialogId: 'd-1',
    });
  });

  it('keeps a drawer open on no conversation out of the URL', () => {
    expect(resolveMingoUrlSync({ ...base, drawerOpen: true })).toEqual({ type: 'none' });
  });

  it('strips the param when the drawer closes', () => {
    expect(
      resolveMingoUrlSync({ ...base, urlDialogId: 'd-1', mirroredDialogId: 'd-1', activeDialogId: 'd-1' }),
    ).toEqual({ type: 'write', dialogId: null });
  });

  it('closes on navigation instead of stamping the dialog onto the new route', () => {
    // The regression this replaces: the projection ran first and wrote
    // `/devices?mingoDialog=d-1` before close-on-navigate could fire.
    expect(
      resolveMingoUrlSync({
        ...base,
        navigated: true,
        mirroredDialogId: 'd-1',
        drawerOpen: true,
        activeDialogId: 'd-1',
      }),
    ).toEqual({ type: 'close' });
  });

  it('adopts across a navigation that carries an instruction', () => {
    // The `/mingo?dialogId=` -> `/dashboard?mingoDialog=` hop. A close living in
    // its own effect would fire on this same commit and shut the drawer that this
    // pass is opening.
    expect(resolveMingoUrlSync({ ...base, navigated: true, urlDialogId: 'd-1' })).toEqual({
      type: 'adopt',
      dialogId: 'd-1',
    });
  });

  it('closes when back lands on an entry without the param, rather than re-stamping it', () => {
    // Same pathname, so `navigated` is false — only `mirroredDialogId` reveals
    // that the URL lost something we put there. Re-stamping would rewrite the
    // history entry the user just returned to and make Back look dead.
    expect(resolveMingoUrlSync({ ...base, mirroredDialogId: 'd-1', drawerOpen: true, activeDialogId: 'd-1' })).toEqual({
      type: 'close',
    });
  });

  it('adopts when back lands on an entry carrying a different param', () => {
    // Same pathname, so this is a traversal rather than a navigation, and the entry
    // names a conversation other than the one being mirrored — the URL wins.
    expect(resolveMingoUrlSync({ ...base, urlDialogId: 'd-1', mirroredDialogId: 'd-2' })).toEqual({
      type: 'adopt',
      dialogId: 'd-1',
    });
  });

  it('switches conversations without an intermediate strip', () => {
    expect(
      resolveMingoUrlSync({
        ...base,
        urlDialogId: 'd-1',
        mirroredDialogId: 'd-1',
        drawerOpen: true,
        activeDialogId: 'd-2',
      }),
    ).toEqual({ type: 'write', dialogId: 'd-2' });
  });

  it('settles: nothing to do when URL and state already agree', () => {
    expect(resolveMingoUrlSync(base)).toEqual({ type: 'none' });
  });
});
