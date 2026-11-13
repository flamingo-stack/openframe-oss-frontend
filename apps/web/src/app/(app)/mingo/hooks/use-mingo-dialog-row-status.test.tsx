/**
 * The chat list row status: the open chat answers from its own thread once its history has loaded, every other row
 * from what the server last said of it, and the open chat's live state is written onto its row so it holds after
 * switching chats.
 */

import type { ChatMessage, ChatPart, MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type { DialogItem, StreamingPhase } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { noteMingoDialogResponse, useMingoDialogRowsStore } from '../stores/mingo-dialog-rows-store';
import { useMingoDialogRowStatus } from './use-mingo-dialog-row-status';

type StatusOf = ReturnType<typeof useMingoDialogRowStatus>;

let root: Root | null = null;

function node(id: string, fields: Partial<MingoDialogNode> = {}): MingoDialogNode {
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

/** A list page as the ai-agent answers it: every row it carries is noted. */
function listed(...nodes: MingoDialogNode[]) {
  act(() => noteMingoDialogResponse({ dialogs: { edges: nodes.map(n => ({ cursor: n.dialogId, node: n })) } }));
}

function row(id: string): DialogItem {
  return { id, title: id };
}

function batch(approvalRequestId: string, status: 'pending' | 'rejected'): ChatPart {
  const base = {
    type: 'dynamic-tool',
    toolName: 'run_script',
    toolCallId: `${approvalRequestId}-row`,
    input: {},
  } as const;
  const approval = {
    id: `${approvalRequestId}-row`,
    descriptor: { approvalType: 'ADMIN', batchId: approvalRequestId },
  };
  return status === 'pending'
    ? { ...base, state: 'approval-requested', approval }
    : { ...base, state: 'output-denied', approval: { ...approval, approved: false } };
}

function thread(...parts: ChatPart[]): ChatMessage[] {
  return [{ id: 'm-1', role: 'assistant', parts }];
}

function mount(options: {
  activeDialogId: string | null;
  phase?: StreamingPhase;
  messages?: ChatMessage[];
  activeThreadLoaded: boolean;
  onScreen?: boolean;
}): { statusOf: () => StatusOf } {
  let latest: StatusOf | null = null;
  function Probe() {
    latest = useMingoDialogRowStatus({ phase: 'idle', messages: [], onScreen: true, ...options });
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Probe />);
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
  useMingoDialogRowsStore.setState({ rows: new Map(), missing: new Set() });
  document.body.innerHTML = '';
});

describe('useMingoDialogRowStatus', () => {
  it('reads the rows of other chats off what the server last said', () => {
    listed(
      node('d-1', { pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } }),
      node('d-2', { streamState: 'STREAMING' }),
      node('d-3'),
    );
    const { statusOf } = mount({ activeDialogId: null, activeThreadLoaded: false });
    expect(statusOf()(row('d-1'))).toBe('approval');
    expect(statusOf()(row('d-2'))).toBe('working');
    expect(statusOf()(row('d-3'))).toBeUndefined();
  });

  it('answers the open chat from its thread, over a stale list row', () => {
    listed(node('d-1'));
    const { statusOf } = mount({
      activeDialogId: 'd-1',
      messages: thread(batch('ar-2', 'pending')),
      activeThreadLoaded: true,
    });
    expect(statusOf()(row('d-1'))).toBe('approval');
  });

  it('keeps the list row until the open chat has loaded its history', () => {
    listed(node('d-1', { pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } }));
    const { statusOf } = mount({ activeDialogId: 'd-1', activeThreadLoaded: false });
    expect(statusOf()(row('d-1'))).toBe('approval');
  });

  it("writes the open chat's state onto its row, which keeps it once another chat opens", () => {
    listed(node('d-1', { pendingApproval: { id: 'ar-2', approvalType: 'ADMIN' } }));
    mount({ activeDialogId: 'd-1', messages: thread(batch('ar-2', 'rejected')), activeThreadLoaded: true });

    const written = useMingoDialogRowsStore.getState().rows.get('d-1');
    expect(written?.awaitingApproval).toBe(false);
    expect(written?.createdAt).toBe('2026-10-09T09:00:00Z');
  });
});

describe('useMingoDialogRowStatus: a reply nobody has read', () => {
  it('marks the rows of other chats that hold one', () => {
    listed(node('d-1', { unreadMessageCount: 2 }), node('d-2', { unreadMessageCount: 0 }), node('d-3'));
    const { statusOf } = mount({ activeDialogId: null, activeThreadLoaded: false });
    expect(statusOf()(row('d-1'))).toBe('unread');
    expect(statusOf()(row('d-2'))).toBeUndefined();
    expect(statusOf()(row('d-3'))).toBeUndefined();
  });

  it('puts the dots and the shield before it', () => {
    listed(
      node('d-1', { unreadMessageCount: 1, streamState: 'STREAMING' }),
      node('d-2', { unreadMessageCount: 1, pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } }),
    );
    const { statusOf } = mount({ activeDialogId: null, activeThreadLoaded: false });
    expect(statusOf()(row('d-1'))).toBe('working');
    expect(statusOf()(row('d-2'))).toBe('approval');
  });

  it('never marks the chat on screen, from the moment it is selected and before its thread has loaded', () => {
    listed(node('d-1', { unreadMessageCount: 3 }));
    const loading = mount({ activeDialogId: 'd-1', activeThreadLoaded: false });
    expect(loading.statusOf()(row('d-1'))).toBeUndefined();
  });

  it('nor once its thread has loaded', () => {
    listed(node('d-1', { unreadMessageCount: 3 }));
    const { statusOf } = mount({ activeDialogId: 'd-1', activeThreadLoaded: true });
    expect(statusOf()(row('d-1'))).toBeUndefined();
  });

  it('marks the open chat while its thread is behind a page', () => {
    listed(node('d-1', { unreadMessageCount: 1 }));
    const { statusOf } = mount({ activeDialogId: 'd-1', activeThreadLoaded: true, onScreen: false });
    expect(statusOf()(row('d-1'))).toBe('unread');
  });

  it('keeps the dots on the open chat behind a page while Mingo still answers there', () => {
    listed(node('d-1', { unreadMessageCount: 1 }));
    const { statusOf } = mount({
      activeDialogId: 'd-1',
      phase: 'streaming',
      activeThreadLoaded: true,
      onScreen: false,
    });
    expect(statusOf()(row('d-1'))).toBe('working');
  });
});
