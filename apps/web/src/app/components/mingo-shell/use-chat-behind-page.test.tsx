import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { ComposerRoute } from './mingo-dock-route';
import { useChatBehindPage } from './use-chat-behind-page';

const KEY = 'of.mingo-chat-behind-page';

/** The session's chat state as far as the hook reads it, settable from the test. */
const session = create<{ active: string | null; loading: boolean; ids: string[] }>(() => ({
  active: null,
  loading: true,
  ids: [],
}));
const selectDialog = vi.fn((id: string | null) => session.setState({ active: id }));

function Harness({ route }: { route: ComposerRoute }) {
  const { active, loading, ids } = session();
  const state = {
    activeDialogId: active,
    isDialogsLoading: loading,
    dialogs: ids.map(id => ({ id, title: id })),
    selectDialog,
  } as unknown as UnifiedChatState;
  useChatBehindPage({ route, state });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function render(route: ComposerRoute) {
  act(() => root.render(<Harness route={route} />));
}

describe('useChatBehindPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    session.setState({ active: null, loading: true, ids: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('brings the chat back on a page once the list has loaded', () => {
    window.sessionStorage.setItem(KEY, 'a');
    render('page');
    expect(selectDialog).not.toHaveBeenCalled();

    act(() => session.setState({ loading: false, ids: ['a', 'b'] }));
    expect(selectDialog).toHaveBeenCalledWith('a');
    expect(window.sessionStorage.getItem(KEY)).toBe('a');
  });

  it('forgets a chat the list no longer has', () => {
    window.sessionStorage.setItem(KEY, 'gone');
    session.setState({ loading: false, ids: ['a'] });
    render('full-width');
    expect(selectDialog).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('brings nothing back on home or on the chat page', () => {
    for (const route of ['home', 'chat'] as const) {
      act(() => root.unmount());
      root = createRoot(container);
      window.sessionStorage.setItem(KEY, 'a');
      session.setState({ active: null, loading: false, ids: ['a'] });
      render(route);
      expect(selectDialog).not.toHaveBeenCalled();
    }
  });

  it('remembers the chat a chat page selected before the list had loaded', () => {
    render('chat');
    act(() => session.setState({ active: 'a' }));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    act(() => session.setState({ loading: false, ids: ['a'] }));
    expect(window.sessionStorage.getItem(KEY)).toBe('a');
  });

  it('remembers every change of the open chat after the restore', () => {
    session.setState({ loading: false, ids: ['a', 'b'] });
    render('page');
    act(() => session.setState({ active: 'b' }));
    expect(window.sessionStorage.getItem(KEY)).toBe('b');
    act(() => session.setState({ active: null }));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('restores once per mount, not on every later deselect', () => {
    window.sessionStorage.setItem(KEY, 'a');
    session.setState({ loading: false, ids: ['a'] });
    render('page');
    expect(selectDialog).toHaveBeenCalledTimes(1);
    act(() => session.setState({ active: null }));
    render('page');
    expect(selectDialog).toHaveBeenCalledTimes(1);
  });
});
