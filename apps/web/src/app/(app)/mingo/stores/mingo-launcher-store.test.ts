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

/**
 * The Mingo-first shell has no drawer: while its composer dock is mounted, every
 * launcher request is ONE dock request, and nothing opens.
 */
describe('mingo launcher: composer dock', () => {
  const store = () => useMingoLauncherStore.getState();

  beforeEach(() => {
    useMingoLauncherStore.setState({
      isOpen: false,
      pendingPrompt: null,
      pendingDraft: null,
      pendingNewChat: false,
      dockMounted: false,
      dockRequest: null,
    });
  });

  it('queues each launcher request for the dock, opening nothing', () => {
    store().setDockMounted(true);
    const draft = { text: 'Fix the disk' };

    for (const [launch, request] of [
      [() => store().sendToMingo('hi'), { kind: 'prompt', prompt: 'hi' }],
      [() => store().draftToMingo(draft), { kind: 'draft', draft }],
      [() => store().startNewChat(), { kind: 'newChat' }],
    ] as const) {
      launch();
      expect(store().dockRequest).toEqual(request);
      expect(store().isOpen).toBe(false);
      expect(store().pendingPrompt).toBeNull();
      expect(store().pendingDraft).toBeNull();
      expect(store().pendingNewChat).toBe(false);
    }
  });

  it('hands a request out once', () => {
    store().setDockMounted(true);
    store().startNewChat();

    expect(store().consumeDockRequest()).toEqual({ kind: 'newChat' });
    expect(store().consumeDockRequest()).toBeNull();
  });

  it('adopts a classic request queued just before the dock mounted', () => {
    store().draftToMingo({ text: 'Fix the disk' });
    expect(store().isOpen).toBe(true);

    store().setDockMounted(true);

    expect(store().dockRequest).toEqual({ kind: 'draft', draft: { text: 'Fix the disk' } });
    expect(store().pendingDraft).toBeNull();
    expect(store().isOpen).toBe(false);
  });

  it('keeps an undrained request for the next dock, and launches the drawer again without one', () => {
    store().setDockMounted(true);
    store().sendToMingo('hi');

    // StrictMode's development remount: what the dock adopted must survive it.
    store().setDockMounted(false);
    expect(store().dockRequest).toEqual({ kind: 'prompt', prompt: 'hi' });

    // A drawer launch supersedes it, like every launcher request does the others.
    store().startNewChat();
    expect(store().pendingNewChat).toBe(true);
    expect(store().isOpen).toBe(true);
    expect(store().dockRequest).toBeNull();
  });
});
