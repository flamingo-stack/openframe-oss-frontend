/**
 * The composer target rule (PLAN §3.7): home is a new chat, entered once per
 * visit and again once its sheet closes; every other page continues the selected chat; any send from a page that is
 * not the chat page goes to its chat — at once into the open one, as soon as the id
 * is known for a created one; sends on the chat page stay put.
 */

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';
import { useComposerTarget } from './use-composer-target';

/** The session's selection, settable from the test the way the store is from anywhere. */
const selection = create<{ active: string | null }>(() => ({ active: null }));
const select = (id: string | null) => selection.setState({ active: id });

const selectDialog = vi.fn(select);
const navigate = vi.fn();
const sendMessage = vi.fn<UnifiedChatState['sendMessage']>();
const sendInNewDialog = vi.fn<(text: string) => Promise<void>>();
const createIntentDialog = vi.fn(async () => null);
const openSheet = vi.fn();

const probe = { target: null as ReturnType<typeof useComposerTarget> | null };
const target = () => {
  if (!probe.target) throw new Error('the harness has not rendered');
  return probe.target;
};

function Harness({ route, sheetOpen }: { route: ComposerRoute; sheetOpen: boolean }) {
  const active = selection(s => s.active);
  const state = { activeDialogId: active, selectDialog, sendMessage } as unknown as UnifiedChatState;
  const result = useComposerTarget({
    route,
    state,
    sendInNewDialog,
    createIntentDialog,
    navigate,
    openSheet,
    sheetOpen,
  });
  useEffect(() => {
    probe.target = result;
  });
  return null;
}

/** A send whose create and whose own completion the test releases separately, like the real two round trips. */
function deferredCreate(newId: string | null) {
  const created = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const send = async () => {
    await created.promise;
    if (newId) select(newId);
    await finished.promise;
  };
  return { send, releaseCreate: () => created.resolve(), finish: () => finished.resolve() };
}

let container: HTMLDivElement;
let root: Root;

function render(route: ComposerRoute, { sheetOpen = false }: { sheetOpen?: boolean } = {}) {
  act(() => {
    root.render(<Harness route={route} sheetOpen={sheetOpen} />);
  });
}

describe('useComposerTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selection.setState({ active: null });
    probe.target = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('deselects the open chat on entering home, once per visit', () => {
    select('a');
    render('page');
    expect(selectDialog).not.toHaveBeenCalled();

    render('home');
    expect(selectDialog).toHaveBeenCalledTimes(1);
    expect(selectDialog).toHaveBeenCalledWith(null);

    // A chat appearing on home afterwards (a send created it) is not deselected.
    act(() => select('b'));
    render('home');
    expect(selectDialog).toHaveBeenCalledTimes(1);

    // Leaving and coming back is a new visit.
    render('page');
    render('home');
    expect(selectDialog).toHaveBeenCalledTimes(2);
  });

  it('keeps a chat collapsed back over home while the sheet is up, then makes home a new chat', async () => {
    sendMessage.mockResolvedValue(undefined);
    select('a');
    render('chat');
    render('home', { sheetOpen: true });
    expect(selectDialog).not.toHaveBeenCalled();

    // Its sends continue it in the sheet: home does not leave for the chat page.
    await act(async () => {
      await target().mingoState.sendMessage('and the other one?');
    });
    expect(sendMessage).toHaveBeenLastCalledWith('and the other one?', undefined);
    expect(navigate).not.toHaveBeenCalled();

    render('home', { sheetOpen: false });
    expect(selectDialog).toHaveBeenCalledTimes(1);
    expect(selectDialog).toHaveBeenCalledWith(null);
  });

  it('does not deselect on any other page', () => {
    select('a');
    for (const route of ['page', 'chat', 'full-width'] as const) render(route);
    expect(selectDialog).not.toHaveBeenCalled();
    expect(selection.getState().active).toBe('a');
  });

  it('opens a chat created by a send from a page over that page, once its id is known', async () => {
    render('page');
    const { send, releaseCreate, finish } = deferredCreate('new-1');
    sendMessage.mockImplementation(send);

    let sending: Promise<unknown> = Promise.resolve();
    act(() => {
      sending = target().mingoState.sendMessage('Why is it offline?');
    });
    expect(openSheet).not.toHaveBeenCalled();

    await act(async () => releaseCreate());
    expect(openSheet).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await sending;
    });
    expect(openSheet).toHaveBeenCalledTimes(1);
  });

  it('opens the open chat over the page for a reply sent from any other page, and stays on it', async () => {
    sendMessage.mockResolvedValue(undefined);
    for (const route of ['page', 'full-width'] as const) {
      openSheet.mockClear();
      select('a');
      render(route);

      await act(async () => {
        await target().mingoState.sendMessage('and the other one?');
      });

      expect(sendMessage).toHaveBeenLastCalledWith('and the other one?', undefined);
      expect(openSheet).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
    }
  });

  it('stays put for a send into the open chat on the chat page', async () => {
    select('a');
    render('chat');
    sendMessage.mockResolvedValue(undefined);

    await act(async () => {
      await target().mingoState.sendMessage('and the other one?');
    });

    expect(sendMessage).toHaveBeenCalledWith('and the other one?', undefined);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stays put when a send on the chat page creates a chat: the page follows it itself', async () => {
    render('chat');
    const { send, releaseCreate, finish } = deferredCreate('new-3');
    sendMessage.mockImplementation(send);

    let sending: Promise<unknown> = Promise.resolve();
    act(() => {
      sending = target().mingoState.sendMessage('a new one');
    });
    await act(async () => releaseCreate());
    await act(async () => {
      finish();
      await sending;
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stays on the chat page when the page selects its chat', () => {
    render('chat');
    act(() => select('a'));
    act(() => select('b'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when a page selection changes the chat without a send', () => {
    select('a');
    render('page');
    act(() => select('b'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("takes a chat that becomes active on home without a send to its page (the tour's)", () => {
    render('home');
    act(() => select('tour-1'));
    expect(navigate).toHaveBeenCalledWith(routes.mingo.chat('tour-1'));
    expect(openSheet).not.toHaveBeenCalled();
  });

  it('leaves a chat selected into the sheet over home there', () => {
    render('home', { sheetOpen: true });
    act(() => select('b'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens a chat created by a send from home over home, and makes home new again once it closes', async () => {
    render('home');
    const { send, releaseCreate, finish } = deferredCreate('new-home');
    sendInNewDialog.mockImplementation(send);

    let sending: Promise<void> = Promise.resolve();
    act(() => {
      sending = target().sendInNewDialog('List every online machine');
    });
    await act(async () => releaseCreate());
    expect(openSheet).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      await sending;
    });

    render('home', { sheetOpen: true });
    expect(selectDialog).not.toHaveBeenCalled();
    render('home', { sheetOpen: false });
    expect(selectDialog).toHaveBeenCalledWith(null);
    expect(selection.getState().active).toBeNull();
  });

  it('opens an always-new send over the page, away from the chat open there', async () => {
    select('a');
    render('page');
    const { send, releaseCreate, finish } = deferredCreate('new-2');
    sendInNewDialog.mockImplementation(send);

    let sending: Promise<void> = Promise.resolve();
    act(() => {
      sending = target().sendInNewDialog('Meet Mingo');
    });
    await act(async () => releaseCreate());
    expect(openSheet).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await sending;
    });
  });

  // MISSING 1.9: the busy / send / create toasts are the session's (`useMingoDialogChat`);
  // the wrapper must neither swallow a failure nor change what the composer is told.
  it("hands the session's answer back to the composer: its result, and its failure", async () => {
    select('a');
    render('chat');
    sendMessage.mockResolvedValueOnce(false);
    await act(async () => {
      await expect(target().mingoState.sendMessage('busy?')).resolves.toBe(false);
    });

    render('page');
    const failure = new Error('Send Failed');
    sendMessage.mockRejectedValueOnce(failure);
    await act(async () => {
      await expect(target().mingoState.sendMessage('again')).rejects.toBe(failure);
    });

    act(() => select(null));
    sendInNewDialog.mockRejectedValueOnce(failure);
    await act(async () => {
      await expect(target().sendInNewDialog('a new one')).rejects.toBe(failure);
    });
    // The failed create disarmed the follow: a later pick from the sidebar does not navigate.
    navigate.mockClear();
    act(() => select('picked'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('disarms when the send created nothing, so a later selection is not taken for it', async () => {
    render('page');
    const { send, releaseCreate, finish } = deferredCreate(null);
    sendMessage.mockImplementation(send);

    await act(async () => {
      const sending = target().mingoState.sendMessage('hello');
      releaseCreate();
      finish();
      await sending;
    });
    act(() => select('picked-from-the-sidebar'));

    expect(navigate).not.toHaveBeenCalled();
  });
});
