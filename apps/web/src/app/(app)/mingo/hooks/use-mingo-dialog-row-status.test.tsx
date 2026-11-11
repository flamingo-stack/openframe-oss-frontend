/**
 * The chat list row status: the open chat answers from its own thread once its
 * history has loaded, every other row from the list query, and the open chat's
 * live state is written onto its list row so it holds after switching chats. A
 * reply nobody has read shows on every row but the chat on screen.
 */

import type { DialogItem, Message, MessageSegment } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { DialogNode } from '../types';
import type { MingoDialogsPage } from '../utils/dialog-row-status';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { useMingoDialogRowStatus } from './use-mingo-dialog-row-status';

type StatusOf = ReturnType<typeof useMingoDialogRowStatus>;

let root: Root | null = null;

function node(id: string, fields: Partial<DialogNode> = {}): DialogNode {
  // `id` is the Relay global id; rows are matched on the raw `dialogId`.
  return {
    id: `global-${id}`,
    dialogId: id,
    title: id,
    status: 'ACTIVE',
    streamState: 'IDLE',
    createdAt: '2026-10-09T09:00:00Z',
    ...fields,
  };
}

function row(id: string): DialogItem {
  return { id, title: id };
}

function batch(approvalRequestId: string, status: 'pending' | 'rejected'): MessageSegment {
  return { type: 'approval_batch', data: { approvalRequestId, approvalType: 'ADMIN', toolCalls: [] }, status };
}

/** The open chat as its stream left it in the store. */
function openChat(dialogId: string, phase: 'idle' | 'streaming', content: MessageSegment[]) {
  const thread: Message[] = [{ id: 'm-1', role: 'assistant', content }];
  useMingoMessagesStore.setState({
    phaseByDialog: new Map([[dialogId, phase]]),
    messagesByDialog: new Map([[dialogId, thread]]),
  });
}

function listData(nodes: DialogNode[]): InfiniteData<MingoDialogsPage> {
  return { pages: [{ dialogs: nodes, pageInfo: { hasNextPage: false } }], pageParams: [undefined] };
}

function mount(
  options: Parameters<typeof useMingoDialogRowStatus>[0],
  queryClient = new QueryClient(),
): { statusOf: () => StatusOf } {
  let latest: StatusOf | null = null;
  function Probe() {
    latest = useMingoDialogRowStatus(options);
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return {
    statusOf: () => {
      if (!latest) throw new Error('not rendered');
      return latest;
    },
  };
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  useMingoMessagesStore.setState({ phaseByDialog: new Map(), messagesByDialog: new Map() });
  document.body.innerHTML = '';
});

describe('useMingoDialogRowStatus', () => {
  it('reads the rows of other chats off the list query', () => {
    const nodes = [
      node('d-1', { pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } }),
      node('d-2', { streamState: 'STREAMING' }),
      node('d-3'),
    ];
    const { statusOf } = mount({ activeDialogId: null, nodes, activeThreadLoaded: false, onScreen: false });
    expect(statusOf()(row('d-1'))).toBe('approval');
    expect(statusOf()(row('d-2'))).toBe('working');
    expect(statusOf()(row('d-3'))).toBeUndefined();
  });

  it('answers the open chat from its thread, over a stale list row', () => {
    openChat('d-1', 'idle', [batch('ar-2', 'pending')]);
    const { statusOf } = mount({
      activeDialogId: 'd-1',
      nodes: [node('d-1')],
      activeThreadLoaded: true,
      onScreen: true,
    });
    expect(statusOf()(row('d-1'))).toBe('approval');
  });

  it('keeps the list row until the open chat has loaded its history', () => {
    openChat('d-1', 'idle', []);
    const nodes = [node('d-1', { pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } })];
    const { statusOf } = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: false, onScreen: true });
    expect(statusOf()(row('d-1'))).toBe('approval');
  });

  it('writes the open chat state onto its list row and leaves other caches alone', () => {
    const queryClient = new QueryClient();
    const listKey = mingoDialogQueryKeys.list({ limit: 20, scope: 'all' });
    queryClient.setQueryData(listKey, listData([node('d-1', { pendingApproval: { id: 'ar-2' } })]));
    const incidentKey = ['mingo-dialogs', 'insight', 'i-1'];
    const incidentData = [{ id: 'd-1' }];
    queryClient.setQueryData(incidentKey, incidentData);

    openChat('d-1', 'idle', [batch('ar-2', 'rejected')]);
    mount({ activeDialogId: 'd-1', nodes: [], activeThreadLoaded: true, onScreen: true }, queryClient);

    const list = queryClient.getQueryData<InfiniteData<MingoDialogsPage>>(listKey);
    expect(list?.pages[0].dialogs[0].pendingApproval).toBeNull();
    expect(queryClient.getQueryData(incidentKey)).toBe(incidentData);
  });
});

describe('useMingoDialogRowStatus: a reply nobody has read', () => {
  it('shows on the rows of other chats, behind the dots and the approval', () => {
    const nodes = [
      node('d-1', { unreadMessageCount: 1 }),
      node('d-2', { unreadMessageCount: 1, streamState: 'STREAMING' }),
      node('d-3', { unreadMessageCount: 2, pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } }),
      node('d-4', { unreadMessageCount: 0 }),
    ];
    const { statusOf } = mount({ activeDialogId: null, nodes, activeThreadLoaded: false, onScreen: false });
    expect(statusOf()(row('d-1'))).toBe('unread');
    expect(statusOf()(row('d-2'))).toBe('working');
    expect(statusOf()(row('d-3'))).toBe('approval');
    expect(statusOf()(row('d-4'))).toBeUndefined();
  });

  it('never shows on the chat on screen, from the moment it is selected', () => {
    // Selected, its thread not loaded yet and the read mark not answered: the list
    // row still counts the reply.
    const nodes = [node('d-1', { unreadMessageCount: 1 })];
    const { statusOf } = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: false, onScreen: true });
    expect(statusOf()(row('d-1'))).toBeUndefined();
  });

  it('stays off the chat on screen once its thread has loaded', () => {
    openChat('d-1', 'idle', []);
    const nodes = [node('d-1', { unreadMessageCount: 1 })];
    const { statusOf } = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: true, onScreen: true });
    expect(statusOf()(row('d-1'))).toBeUndefined();
  });

  it('shows on the open chat while a page hides it', () => {
    openChat('d-1', 'idle', []);
    const nodes = [node('d-1', { unreadMessageCount: 1 })];
    const { statusOf } = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: true, onScreen: false });
    expect(statusOf()(row('d-1'))).toBe('unread');
  });

  it('keeps the hidden open chat on its live dots and approval first', () => {
    const nodes = [node('d-1', { unreadMessageCount: 1 })];
    openChat('d-1', 'streaming', []);
    const working = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: true, onScreen: false });
    expect(working.statusOf()(row('d-1'))).toBe('working');
    act(() => {
      root?.unmount();
    });

    openChat('d-1', 'idle', [batch('ar-2', 'pending')]);
    const waiting = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: true, onScreen: false });
    expect(waiting.statusOf()(row('d-1'))).toBe('approval');
  });

  it('leaves the other rows alone while a chat is on screen', () => {
    const nodes = [node('d-1', { unreadMessageCount: 1 }), node('d-2', { unreadMessageCount: 1 })];
    const { statusOf } = mount({ activeDialogId: 'd-1', nodes, activeThreadLoaded: false, onScreen: true });
    expect(statusOf()(row('d-2'))).toBe('unread');
  });
});
