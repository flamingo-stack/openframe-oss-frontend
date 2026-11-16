/**
 * The chat list's row states, as each ai-agent answer leaves them.
 */

import type { MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  nextMingoRowsTick,
  noteMingoDialogRead,
  noteMingoDialogResponse,
  useMingoDialogRowsStore,
} from './mingo-dialog-rows-store';

const listNode = (dialogId: string, pendingApproval: MingoDialogNode['pendingApproval']) =>
  ({ dialogId, createdAt: '2026-11-13T10:00:00Z', streamState: 'IDLE', pendingApproval }) as MingoDialogNode;

/** The open dialog's record: its query selects no `pendingApproval`. */
const recordNode = (dialogId: string) =>
  ({ dialogId, createdAt: '2026-11-13T10:00:00Z', streamState: 'IDLE' }) as MingoDialogNode;

const row = (dialogId: string) => useMingoDialogRowsStore.getState().rows.get(dialogId);

beforeEach(() => {
  useMingoDialogRowsStore.setState({ rows: new Map(), missing: new Set() });
});

describe('noteMingoDialogResponse', () => {
  it("keeps a row's pending approval when the dialog's record, which does not select it, answers after the list", () => {
    noteMingoDialogResponse({
      dialogs: { edges: [{ node: listNode('d-1', { id: 'a-1' } as MingoDialogNode['pendingApproval']) }] },
    });
    noteMingoDialogResponse({ dialog: recordNode('d-1') });

    expect(row('d-1')).toMatchObject({ awaitingApproval: true, approvalRequestId: 'a-1', streaming: false });
  });

  it('clears it when a list page answers that none is pending', () => {
    noteMingoDialogResponse({
      dialogs: { edges: [{ node: listNode('d-1', { id: 'a-1' } as MingoDialogNode['pendingApproval']) }] },
    });
    noteMingoDialogResponse({ dialogs: { edges: [{ node: listNode('d-1', null) }] } });

    expect(row('d-1')).toMatchObject({ awaitingApproval: false });
    expect(row('d-1')?.approvalRequestId).toBeUndefined();
  });

  it('takes a record that comes first as no approval known', () => {
    noteMingoDialogResponse({ dialog: recordNode('d-2') });
    expect(row('d-2')).toMatchObject({ awaitingApproval: false, streaming: false });
  });
});

/** A list row as the chat list's query answers it: with the viewer's unread replies and the owner. */
const unreadNode = (dialogId: string, unreadMessageCount: number) =>
  ({
    id: `global-${dialogId}`,
    dialogId,
    createdAt: '2026-11-13T10:00:00Z',
    streamState: 'IDLE',
    pendingApproval: null,
    unreadMessageCount,
    owner: { type: 'ADMIN', userId: 'u-1' },
  }) as MingoDialogNode;

const listOf = (...nodes: MingoDialogNode[]) => ({ dialogs: { edges: nodes.map(node => ({ node })) } });

describe('noteMingoDialogResponse: unread replies', () => {
  it("holds a row's unread replies, the id a mutation takes and its owner", () => {
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), nextMingoRowsTick());
    expect(row('d-1')).toMatchObject({ unread: 2, nodeId: 'global-d-1', ownerUserId: 'u-1' });
  });

  it('keeps them when an answer that did not select them comes after', () => {
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), nextMingoRowsTick());
    noteMingoDialogResponse({ dialog: recordNode('d-1') }, nextMingoRowsTick());
    expect(row('d-1')).toMatchObject({ unread: 2, ownerUserId: 'u-1' });
  });

  it('reads a row nothing has said anything about as nothing unread', () => {
    noteMingoDialogResponse({ dialog: recordNode('d-2') }, nextMingoRowsTick());
    expect(row('d-2')?.unread).toBe(0);
  });
});

describe('noteMingoDialogRead', () => {
  it('writes what the viewer has left to read', () => {
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), nextMingoRowsTick());
    noteMingoDialogRead('d-1', 0);
    expect(row('d-1')?.unread).toBe(0);
  });

  it('is not undone by an answer that was asked before it', () => {
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), nextMingoRowsTick());
    const askedBefore = nextMingoRowsTick();
    noteMingoDialogRead('d-1', 0);
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), askedBefore);
    expect(row('d-1')?.unread).toBe(0);
  });

  it('nor by an answer that does not say when it was asked', () => {
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), nextMingoRowsTick());
    noteMingoDialogRead('d-1', 0);
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)));
    expect(row('d-1')?.unread).toBe(0);
  });

  it('gives way to an answer asked after it: a reply that came since', () => {
    noteMingoDialogResponse(listOf(unreadNode('d-1', 2)), nextMingoRowsTick());
    noteMingoDialogRead('d-1', 0);
    noteMingoDialogResponse(listOf(unreadNode('d-1', 1)), nextMingoRowsTick());
    expect(row('d-1')?.unread).toBe(1);
  });

  it('does nothing for a chat the list has not named', () => {
    noteMingoDialogRead('d-9', 0);
    expect(row('d-9')).toBeUndefined();
  });
});
