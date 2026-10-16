import { beforeEach, describe, expect, it } from 'vitest';
import { useMingoLauncherStore } from './mingo-launcher-store';

/** Every launcher request is ONE dock request, drained once. */
describe('mingo launcher', () => {
  const store = () => useMingoLauncherStore.getState();

  beforeEach(() => {
    useMingoLauncherStore.setState({ dockMounted: false, dockRequest: null });
  });

  it('queues each launcher request for the dock, replacing a pending one', () => {
    const draft = { text: 'Fix the disk' };

    for (const [launch, request] of [
      [() => store().sendToMingo('hi'), { kind: 'prompt', prompt: 'hi' }],
      [() => store().draftToMingo(draft), { kind: 'draft', draft }],
      [() => store().startNewChat(), { kind: 'newChat' }],
    ] as const) {
      launch();
      expect(store().dockRequest).toEqual(request);
    }
  });

  it('hands a request out once', () => {
    store().startNewChat();

    expect(store().consumeDockRequest()).toEqual({ kind: 'newChat' });
    expect(store().consumeDockRequest()).toBeNull();
  });

  it('keeps an undrained request across an unmount, for the next dock', () => {
    store().setDockMounted(true);
    store().sendToMingo('hi');

    // StrictMode's development remount.
    store().setDockMounted(false);

    expect(store().dockRequest).toEqual({ kind: 'prompt', prompt: 'hi' });
  });
});
