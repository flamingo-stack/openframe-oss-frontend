/**
 * "Start New Chat" in a phone's chat list: Mingo's home, a new chat about the page the
 * list was opened over. What the home's chip, "Back" and the first message then read.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoPhoneChatList } from './mingo-phone-chat-list';
import { useMingoSheetStore } from './mingo-sheet-store';

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChat: () => ({
    chat: { state: { dialogs: [], loadMoreDialogs: vi.fn() } },
    error: null,
    copyDialogLink: vi.fn(),
  }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  MingoHistoryRail: ({ onNewChat }: { onNewChat?: () => void }) => (
    <button type="button" onClick={onNewChat}>
      Start New Chat
    </button>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockReset();
  useMingoSheetStore.setState({ outsidePage: '/settings/', newChatPage: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useMingoSheetStore.setState({ outsidePage: null, newChatPage: null });
  window.sessionStorage.clear();
});

describe('MingoPhoneChatList', () => {
  it('starts a new chat on the home, about the page under the list', () => {
    act(() => root.render(<MingoPhoneChatList />));
    act(() => container.querySelector('button')?.click());

    expect(useMingoSheetStore.getState().newChatPage).toBe('/settings/');
    expect(push).toHaveBeenCalledWith(routes.mingo.home);
  });
});
