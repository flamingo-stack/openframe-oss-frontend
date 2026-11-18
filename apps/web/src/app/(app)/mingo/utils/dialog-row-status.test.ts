import type { ChatMessage, ChatPart, MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { describe, expect, it } from 'vitest';
import { dialogRowStatus, liveRowState, serverRowState } from './dialog-row-status';

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

function reply(...parts: ChatPart[]): ChatMessage {
  return { id: `m-${parts.length}`, role: 'assistant', parts };
}

/** How Mingo asks: a batch card that stays in the thread, one part per call. */
function batch(approvalRequestId: string, status: 'pending' | 'approved' | 'rejected' = 'pending'): ChatPart {
  const toolCallId = `${approvalRequestId}-row`;
  const base = { type: 'dynamic-tool', toolName: 'run_script', toolCallId, input: {} } as const;
  const approval = { id: toolCallId, descriptor: { approvalType: 'ADMIN', batchId: approvalRequestId } };
  if (status === 'pending') return { ...base, state: 'approval-requested', approval };
  if (status === 'approved') return { ...base, state: 'approval-responded', approval: { ...approval, approved: true } };
  return { ...base, state: 'output-denied', approval: { ...approval, approved: false } };
}

const TEXT: ChatPart = { type: 'text', text: 'Creating the article.' };

describe('dialogRowStatus', () => {
  it('shows the working dots while Mingo answers, even with an approval pending', () => {
    expect(dialogRowStatus({ streaming: true, awaitingApproval: true })).toBe('working');
  });

  it('shows the approval glyph while the chat waits for one', () => {
    expect(dialogRowStatus({ streaming: false, awaitingApproval: true })).toBe('approval');
  });

  it('gives an idle chat no status', () => {
    expect(dialogRowStatus({ streaming: false, awaitingApproval: false })).toBeUndefined();
  });

  it('marks an idle chat that holds a reply nobody has read', () => {
    expect(dialogRowStatus({ streaming: false, awaitingApproval: false }, true)).toBe('unread');
  });

  it('puts the dots and the shield before an unread reply', () => {
    expect(dialogRowStatus({ streaming: true, awaitingApproval: false }, true)).toBe('working');
    expect(dialogRowStatus({ streaming: false, awaitingApproval: true }, true)).toBe('approval');
  });
});

describe('serverRowState', () => {
  it('reads the pending approval and the stream state off the list row', () => {
    expect(serverRowState(node('d-1', { pendingApproval: { id: 'ar-1', approvalType: 'ADMIN' } }))).toEqual({
      streaming: false,
      awaitingApproval: true,
      approvalRequestId: 'ar-1',
    });
    expect(serverRowState(node('d-1', { streamState: 'STREAMING', pendingApproval: null }))).toMatchObject({
      streaming: true,
      awaitingApproval: false,
    });
  });
});

describe('liveRowState', () => {
  it('waits on a pending batch card in the thread', () => {
    expect(liveRowState('idle', [reply(TEXT, batch('ar-2'))])).toEqual({
      streaming: false,
      awaitingApproval: true,
      approvalRequestId: 'ar-2',
    });
  });

  it('waits on a pending single request too', () => {
    const request: ChatPart = {
      type: 'dynamic-tool',
      toolName: 'command',
      toolCallId: 'ar-3',
      title: 'createKnowledgeBaseArticle',
      state: 'approval-requested',
      input: {},
      approval: { id: 'ar-3' },
    };
    expect(liveRowState('idle', [reply(request)]).approvalRequestId).toBe('ar-3');
  });

  it('is not waiting once the request is resolved, in any copy of the card', () => {
    expect(liveRowState('idle', [reply(batch('ar-2', 'approved'))]).awaitingApproval).toBe(false);
    expect(liveRowState('idle', [reply(batch('ar-2')), reply(batch('ar-2', 'rejected'))]).awaitingApproval).toBe(false);
  });

  it('works while the phase is not idle', () => {
    expect(liveRowState('streaming', [reply(TEXT)])).toEqual({
      streaming: true,
      awaitingApproval: false,
      approvalRequestId: undefined,
    });
  });
});
