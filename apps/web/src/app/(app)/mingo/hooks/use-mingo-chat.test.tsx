// Pins how a created dialog reaches the chat lists: listed at once, and then
// refetched so the server's row takes over - except for a dialog its creator
// names, which is listed under that name and left for the rename to refresh. A
// refetch before the rename lands brings the server's untitled row, and the list
// shows the conversation as "New Chat" after all.

import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFullImageUrl } from '@/lib/image-url';
import { bindMingoDialog, useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { MingoDialogsPage } from '../utils/dialog-row-status';
import { forgetCreatedDialogs } from '../utils/insert-new-dialog';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { useMingoDialogChat } from './use-mingo-chat';

type DialogsData = InfiniteData<MingoDialogsPage, string | undefined>;

const { createDialog } = vi.hoisted(() => ({ createDialog: vi.fn(async () => 'd-new') }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/stores', () => {
  const state = { user: { id: 'u-1', firstName: 'Ann' } };
  return {
    selectUser: (current: { user: unknown }) => current.user,
    useAuthStore: Object.assign((selector: (current: typeof state) => unknown) => selector(state), {
      getState: () => state,
    }),
  };
});
vi.mock('../services/mingo-api-service', () => ({
  useCreateDialogMutation: () => ({ mutateAsync: createDialog }),
  useSendMessageMutation: () => ({ mutateAsync: vi.fn() }),
  useStopGenerationMutation: () => ({ mutateAsync: vi.fn() }),
}));

const LIST_KEY = mingoDialogQueryKeys.list({ limit: 20, scope: 'my' });

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let chat: ReturnType<typeof useMingoDialogChat>;

function renderChat() {
  function Probe() {
    chat = useMingoDialogChat(null);
    return null;
  }
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
}

const firstRow = () => client.getQueryData<DialogsData>(LIST_KEY)?.pages[0].dialogs[0];

beforeEach(() => {
  createDialog.mockClear();
  client = new QueryClient();
  client.setQueryData<DialogsData>(LIST_KEY, {
    pages: [{ dialogs: [], pageInfo: { hasNextPage: false } }],
    pageParams: [undefined],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  forgetCreatedDialogs();
});

describe('useMingoDialogChat - createDialog', () => {
  it('lists an ordinary dialog as untitled and refetches the lists', async () => {
    renderChat();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(() => chat.createDialog());

    expect(firstRow()).toMatchObject({ dialogId: 'd-new', title: '' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['mingo-dialogs'] });
  });

  it('lists a named dialog under its name and leaves the refetch to the rename', async () => {
    renderChat();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(() => chat.createDialog({ title: 'Welcome to OpenFrame' }));

    expect(createDialog).toHaveBeenCalledWith({});
    expect(firstRow()).toMatchObject({ dialogId: 'd-new', title: 'Welcome to OpenFrame' });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useMingoDialogChat - the thread', () => {
  const DIALOG = 'd-thread';

  function renderThread() {
    function Probe() {
      chat = useMingoDialogChat(DIALOG);
      return null;
    }
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  }

  beforeEach(() => {
    useMingoMessagesStore.getState().resetAll();
  });

  afterEach(() => {
    useMingoMessagesStore.getState().resetAll();
  });

  it('draws an author avatar as a full URL, and keeps an untouched row the same object across chunks', () => {
    useMingoMessagesStore.getState().setMessages(DIALOG, [
      {
        id: 'u-1',
        role: 'user',
        metadata: { author: { authorType: 'admin', name: 'Ann', avatar: '/api/images/ann.png' } },
        parts: [{ type: 'text', text: 'Hello' }],
      },
    ]);
    renderThread();
    const [row] = chat.messages;
    expect(row.metadata?.author?.avatar).toBe(getFullImageUrl('/api/images/ann.png'));

    const bound = bindMingoDialog(DIALOG);
    act(() => bound.apply(bound.decode({ type: 'MESSAGE_START', streamSeq: 1 })));

    expect(chat.messages[0]).toBe(row);
  });

  it('sends one user row with its author and context, and the echo of it draws no second', async () => {
    renderThread();
    await act(async () => {
      await chat.sendMessage('Check device 7', undefined, {
        contextItems: [{ type: 'device', id: 'd-7', label: 'Device 7' }],
      });
    });
    const bound = bindMingoDialog(DIALOG);
    act(() =>
      bound.apply(
        bound.decode({
          type: 'MESSAGE_REQUEST',
          text: 'Check device 7',
          ownerType: 'ADMIN',
          userId: 'u-1',
          streamSeq: 1,
        }),
      ),
    );

    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0]).toMatchObject({
      role: 'user',
      metadata: {
        author: { authorType: 'admin', name: 'Ann' },
        contextItems: [{ type: 'device', id: 'd-7', label: 'Device 7' }],
      },
      parts: [{ type: 'text', text: 'Check device 7' }],
    });
  });
});
