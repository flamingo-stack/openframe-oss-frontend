import { beforeEach, describe, expect, it } from 'vitest';
import { useMingoLauncherStore } from './mingo-launcher-store';

/**
 * `closedForNavigation` is read one effect later than it is written, and the
 * card-click path closes the drawer TWICE in the same handler. These pin who may
 * clear it — the defect they replace was a `setOpen(false)` that reset the flag
 * right after `closeForNavigation` set it, putting the dead in-chat link back.
 */
describe('mingo launcher: closedForNavigation', () => {
  beforeEach(() => {
    useMingoLauncherStore.setState({ isOpen: false, closedForNavigation: false });
  });

  it("survives the panel's own close landing in the same handler", () => {
    const store = () => useMingoLauncherStore.getState();
    store().setOpen(true);

    // The card click: runtime `navigate` closes for the navigation, then the lib
    // panel's `closeChat` arrives through `onOpenChange(false)`.
    //
    // NOTE: this test pins call-order, not a real guard: it only passes because
    // `setOpen(false)` happens to leave `closedForNavigation` untouched when the
    // flag is already true. There is no explicit "ignore next close" transition
    // in the store to make this robust against a future `setOpen` refactor that
    // starts clearing the flag on every close. If `setOpen` changes, this test
    // is the only thing that will catch it — treat a failure here as a signal to
    // harden the store implementation, not just to patch the test.
    store().closeForNavigation();
    store().setOpen(false);

    expect(store().closedForNavigation).toBe(true);
  });

  it('survives a plain close too', () => {
    const store = () => useMingoLauncherStore.getState();
    store().closeForNavigation();
    store().close();

    expect(store().closedForNavigation).toBe(true);
  });

  it('is cleared by every path that opens the drawer', () => {
    const store = () => useMingoLauncherStore.getState();

    for (const open of [
      () => store().setOpen(true),
      () => store().toggle(),
      () => store().sendToMingo('hi'),
      () => store().startNewChat(),
    ]) {
      useMingoLauncherStore.setState({ isOpen: false, closedForNavigation: true });
      open();
      expect(store().closedForNavigation).toBe(false);
      expect(store().isOpen).toBe(true);
    }
  });

  it('does not set the flag on an ordinary close', () => {
    const store = () => useMingoLauncherStore.getState();
    store().setOpen(true);
    store().close();

    expect(store().closedForNavigation).toBe(false);
  });
});
