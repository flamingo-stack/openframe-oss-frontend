/**
 * The chat list's row states, as each ai-agent answer leaves them.
 */

import type { MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { noteMingoDialogResponse, useMingoDialogRowsStore } from './mingo-dialog-rows-store';

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
