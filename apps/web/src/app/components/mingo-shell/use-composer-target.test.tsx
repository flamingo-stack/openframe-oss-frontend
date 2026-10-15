/**
 * The composer target rule (PLAN §3.7): home is a new chat, entered once per
 * visit; every other page continues the selected chat; a send that creates a chat
 * follows it to its page as soon as the id is known; a send into the open chat
 * stays put.
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

const probe = { target: null as ReturnType<typeof useComposerTarget> | null };
const target = () => {
  if (!probe.target) throw new Error('the harness has not rendered');
  return probe.target;
};

function Harness({ route }: { route: ComposerRoute }) {
  const active = selection(s => s.active);
  const state = { activeDialogId: active, selectDialog, sendMessage } as unknown as UnifiedChatState;
  const result = useComposerTarget({ route, state, sendInNewDialog, navigate });
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

function render(route: ComposerRoute) {
  act(() => {
    root.render(<Harness route={route} />);
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

  it('does not deselect on any other page', () => {
    select('a');
    for (const route of ['page', 'chat', 'full-width'] as const) render(route);
    expect(selectDialog).not.toHaveBeenCalled();
    expect(selection.getState().active).toBe('a');
  });

  it('follows a chat created by a send from a page to its chat page, once its id is known', async () => {
    render('page');
    const { send, releaseCreate, finish } = deferredCreate('new-1');
    sendMessage.mockImplementation(send);

    let sending: Promise<unknown> = Promise.resolve();
    act(() => {
      sending = target().mingoState.sendMessage('Why is it offline?');
    });
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => releaseCreate());
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(routes.mingo.chat('new-1'));

    await act(async () => {
      finish();
      await sending;
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('stays put for a send into the open chat', async () => {
    select('a');
    render('page');
    sendMessage.mockResolvedValue(undefined);

    await act(async () => {
      await target().mingoState.sendMessage('and the other one?');
    });

    expect(sendMessage).toHaveBeenCalledWith('and the other one?', undefined);
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

  it('follows any chat that becomes active on home', () => {
    render('home');
    // e.g. the home page's own quick action: `sendInNewDialog` straight from the session.
    act(() => select('quick-1'));
    expect(navigate).toHaveBeenCalledWith(routes.mingo.chat('quick-1'));
  });

  it('follows an always-new send away from the chat open on a page', async () => {
    select('a');
    render('page');
    const { send, releaseCreate, finish } = deferredCreate('new-2');
    sendInNewDialog.mockImplementation(send);

    let sending: Promise<void> = Promise.resolve();
    act(() => {
      sending = target().sendInNewDialog('Meet Mingo');
    });
    await act(async () => releaseCreate());
    expect(navigate).toHaveBeenCalledWith(routes.mingo.chat('new-2'));

    await act(async () => {
      finish();
      await sending;
    });
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
