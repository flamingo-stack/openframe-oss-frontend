/**
 * When the open Mingo chat is marked read, and when it is not: on screen and owned
 * by the user, once per on-screen period and once per reply that ends there, with a
 * person present. A reply that ends behind a page is read back instead, so its row
 * shows it.
 */

import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { DialogNode } from '../types';
import type { MingoDialogsPage } from '../utils/dialog-row-status';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { isOwnMingoDialog, useMingoDialogAutoRead } from './use-mingo-dialog-read';

const mocks = vi.hoisted(() => ({
  markDialogMessagesRead: vi.fn<(id: string) => Promise<number>>(),
  post: vi.fn(),
  present: true,
  attentionListeners: new Set<() => void>(),
}));

vi.mock('../../tickets/services', () => ({
  ticketService: { markDialogMessagesRead: mocks.markDialogMessagesRead },
}));
vi.mock('@/lib/api-client', () => ({ apiClient: { post: mocks.post } }));
vi.mock('@/lib/session-activity', () => ({
  PRESENCE_IDLE_MS: 300_000,
  isSessionActive: () => mocks.present,
  subscribeAttention: (listener: () => void) => {
    mocks.attentionListeners.add(listener);
    return () => mocks.attentionListeners.delete(listener);
  },
}));

const ME = 'u-1';
const LIST_KEY = mingoDialogQueryKeys.list({ limit: 20, scope: 'my' });

function chat(dialogId: string, fields: Partial<DialogNode> = {}): DialogNode {
  return {
    id: `global-${dialogId}`,
    dialogId,
    title: dialogId,
    status: 'ACTIVE',
    streamState: 'IDLE',
    createdAt: '2026-11-11T09:00:00Z',
    owner: { type: 'ADMIN', userId: ME },
    ...fields,
  };
}

function listData(...nodes: DialogNode[]): InfiniteData<MingoDialogsPage> {
  return { pages: [{ dialogs: nodes, pageInfo: { hasNextPage: false } }], pageParams: [undefined] };
}

function unreadOf(queryClient: QueryClient, dialogId: string): number | undefined {
  const data = queryClient.getQueryData<InfiniteData<MingoDialogsPage>>(LIST_KEY);
  return data?.pages.flatMap(page => page.dialogs).find(node => node.dialogId === dialogId)?.unreadMessageCount;
}

function setPhase(dialogId: string, phase: 'idle' | 'streaming') {
  act(() => {
    useMingoMessagesStore.setState({ phaseByDialog: new Map([[dialogId, phase]]) });
  });
}

/** Let the mark-read's awaits (the request, the cancel) run to the end. */
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

type Options = Parameters<typeof useMingoDialogAutoRead>[0];

let root: Root | null = null;

function Probe(options: Options) {
  useMingoDialogAutoRead(options);
  return null;
}

function mount(options: Options, queryClient = new QueryClient()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const render = (next: Options) =>
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <Probe {...next} />
        </QueryClientProvider>,
      );
    });
  render(options);
  return { render, queryClient };
}

beforeEach(() => {
  mocks.present = true;
  mocks.markDialogMessagesRead.mockReset().mockResolvedValue(0);
  mocks.post.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  mocks.attentionListeners.clear();
  useMingoMessagesStore.setState({ phaseByDialog: new Map() });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('isOwnMingoDialog', () => {
  it('is the chat the signed-in admin created', () => {
    expect(isOwnMingoDialog(chat('d-1'), ME)).toBe(true);
    expect(isOwnMingoDialog(chat('d-1', { owner: { type: 'ADMIN', userId: 'u-2' } }), ME)).toBe(false);
  });

  it('is never a chat with no admin owner, or one seen before the user is known', () => {
    expect(isOwnMingoDialog(chat('d-1', { owner: { type: 'CLIENT', machineId: 'm-1' } }), undefined)).toBe(false);
    expect(isOwnMingoDialog(chat('d-1', { owner: undefined }), ME)).toBe(false);
    expect(isOwnMingoDialog(chat('d-1'), undefined)).toBe(false);
    expect(isOwnMingoDialog(null, ME)).toBe(false);
  });
});

describe('useMingoDialogAutoRead: a chat on screen', () => {
  it('marks my chat read once, by its Relay id, and zeroes its list row', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(LIST_KEY, listData(chat('d-1', { unreadMessageCount: 2 }), chat('d-2')));
    const { render } = mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true }, queryClient);
    await settle();

    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledWith('global-d-1');
    expect(unreadOf(queryClient, 'd-1')).toBe(0);

    // The record polling in again is not another visit.
    render({ dialog: chat('d-1', { title: 'renamed' }), currentUserId: ME, onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
  });

  it('waits for the chat record: a deep link marks once it has loaded', async () => {
    const { render } = mount({ dialog: null, currentUserId: ME, onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();

    render({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledWith('global-d-1');
  });

  it('marks each chat as it is opened', async () => {
    const { render } = mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    render({ dialog: chat('d-2'), currentUserId: ME, onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead.mock.calls).toEqual([['global-d-1'], ['global-d-2']]);
  });

  it('marks again when a reply ends there', async () => {
    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    setPhase('d-1', 'streaming');
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    setPhase('d-1', 'idle');
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('sends nothing for a chat someone else owns', async () => {
    const theirs = chat('d-1', { owner: { type: 'ADMIN', userId: 'u-2' } });
    mount({ dialog: theirs, currentUserId: ME, onScreen: true });
    setPhase('d-1', 'streaming');
    setPhase('d-1', 'idle');
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('sends nothing while the owner or the user is not known', async () => {
    mount({
      dialog: chat('d-1', { owner: { type: 'CLIENT', machineId: 'm-1' } }),
      currentUserId: undefined,
      onScreen: true,
    });
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
  });
});

describe('useMingoDialogAutoRead: nobody at the desk', () => {
  it('owes the mark until attention returns', async () => {
    mocks.present = false;
    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();

    mocks.present = true;
    act(() => {
      for (const listener of mocks.attentionListeners) listener();
    });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
  });

  it('owes one mark for a reply that ended unattended, paid once', async () => {
    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    mocks.present = false;
    setPhase('d-1', 'streaming');
    setPhase('d-1', 'idle');
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    mocks.present = true;
    act(() => {
      for (const listener of mocks.attentionListeners) listener();
    });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);

    // Attention with nothing owed marks nothing.
    act(() => {
      for (const listener of mocks.attentionListeners) listener();
    });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
  });
});

describe('useMingoDialogAutoRead: the open chat behind a page', () => {
  it('marks nothing, and reads a reply that ended there back onto its row', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(LIST_KEY, listData(chat('d-1', { unreadMessageCount: 0 })));
    mocks.post.mockResolvedValue({
      ok: true,
      data: { data: { dialog: { id: 'global-d-1', dialogId: 'd-1', unreadMessageCount: 1 } } },
    });

    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: false }, queryClient);
    setPhase('d-1', 'streaming');
    setPhase('d-1', 'idle');
    await settle();

    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][1].variables).toEqual({ id: 'global-d-1' });
    expect(unreadOf(queryClient, 'd-1')).toBe(1);
  });

  it('marks it read when the chat is shown again', async () => {
    const { render } = mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    render({ dialog: chat('d-1'), currentUserId: ME, onScreen: false });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    render({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
  });

  it('leaves a failed read-back to the next poll', async () => {
    mocks.post.mockResolvedValue({ ok: false, error: 'boom', status: 500 });
    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: false });
    setPhase('d-1', 'streaming');
    setPhase('d-1', 'idle');
    await settle();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
});

describe('useMingoDialogAutoRead: the list around the mark', () => {
  it('drops a list read that was in flight, so it cannot bring the old count back', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(LIST_KEY, listData(chat('d-1', { unreadMessageCount: 1 })));
    // A poll that left before the mark and answers after it, with the count it saw.
    let answerPoll: (data: InfiniteData<MingoDialogsPage>) => void = () => {};
    const poll = queryClient
      .fetchQuery({
        queryKey: LIST_KEY,
        queryFn: () => new Promise<InfiniteData<MingoDialogsPage>>(resolve => (answerPoll = resolve)),
        staleTime: 0,
      })
      .catch(() => undefined);

    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true }, queryClient);
    await settle();
    answerPoll(listData(chat('d-1', { unreadMessageCount: 1 })));
    await poll;
    await settle();

    expect(unreadOf(queryClient, 'd-1')).toBe(0);
  });

  it('never drops the first load of a list', async () => {
    const queryClient = new QueryClient();
    let answerLoad: (data: InfiniteData<MingoDialogsPage>) => void = () => {};
    const load = queryClient.fetchQuery({
      queryKey: LIST_KEY,
      queryFn: () => new Promise<InfiniteData<MingoDialogsPage>>(resolve => (answerLoad = resolve)),
    });

    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true }, queryClient);
    await settle();
    answerLoad(listData(chat('d-1', { unreadMessageCount: 0 })));
    await expect(load).resolves.toBeDefined();
    expect(unreadOf(queryClient, 'd-1')).toBe(0);
  });

  it('says nothing when the mark is refused, and has the lists read again', async () => {
    mocks.markDialogMessagesRead.mockRejectedValue(new Error('refused'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(LIST_KEY, listData(chat('d-1', { unreadMessageCount: 1 })));
    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true }, queryClient);
    await settle();

    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
  });

  it('runs once more for a reply that ended while a mark was in flight', async () => {
    let answerFirst: (count: number) => void = () => {};
    mocks.markDialogMessagesRead.mockImplementationOnce(() => new Promise<number>(resolve => (answerFirst = resolve)));
    mount({ dialog: chat('d-1'), currentUserId: ME, onScreen: true });
    await settle();
    setPhase('d-1', 'streaming');
    setPhase('d-1', 'idle');
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    answerFirst(0);
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
  });
});
