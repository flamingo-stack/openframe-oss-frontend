// Pins how a created dialog reaches the chat lists: listed at once, and then
// refetched so the server's row takes over - except for a dialog its creator
// names, which is listed under that name and left for the rename to refresh. A
// refetch before the rename lands brings the server's untitled row, and the list
// shows the conversation as "New Chat" after all.

import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('@/stores', () => ({
  selectUser: (state: { user: unknown }) => state.user,
  useAuthStore: (selector: (state: { user: { id: string; firstName: string } }) => unknown) =>
    selector({ user: { id: 'u-1', firstName: 'Ann' } }),
}));
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
