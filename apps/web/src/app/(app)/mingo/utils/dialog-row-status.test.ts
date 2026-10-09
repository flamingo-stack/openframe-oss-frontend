import type { Message, MessageSegment } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { DialogNode } from '../types';
import {
  dialogRowStatus,
  liveRowState,
  type MingoDialogsPage,
  serverRowState,
  withLiveRowState,
} from './dialog-row-status';

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

function pages(...dialogPages: DialogNode[][]): InfiniteData<MingoDialogsPage> {
  return {
    pages: dialogPages.map(dialogs => ({ dialogs, pageInfo: { hasNextPage: false } })),
    pageParams: dialogPages.map(() => undefined),
  };
}

function reply(...content: MessageSegment[]): Message {
  return { id: `m-${content.length}`, role: 'assistant', content };
}

/** How Mingo asks: a batch card that stays in the thread. */
function batch(approvalRequestId: string, status: 'pending' | 'approved' | 'rejected' = 'pending'): MessageSegment {
  return { type: 'approval_batch', data: { approvalRequestId, approvalType: 'ADMIN', toolCalls: [] }, status };
}

const TEXT: MessageSegment = { type: 'text', text: 'Creating the article.' };

describe('dialogRowStatus', () => {
  it('shows the working dots while Mingo answers, even with an approval pending', () => {
    expect(dialogRowStatus({ streaming: true, awaitingApproval: true })).toBe('working');
  });

  it('shows the approval glyph while the chat waits for one', () => {
    expect(dialogRowStatus({ streaming: false, awaitingApproval: true })).toBe('approval');
  });

  it('leaves an idle chat to the lib (unread replies)', () => {
    expect(dialogRowStatus({ streaming: false, awaitingApproval: false })).toBeUndefined();
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
    const request: MessageSegment = {
      type: 'approval_request',
      data: { command: 'createKnowledgeBaseArticle', requestId: 'ar-3' },
      status: 'pending',
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

describe('withLiveRowState', () => {
  const waiting = liveRowState('idle', [reply(batch('ar-2'))]);
  const settled = liveRowState('idle', [reply(batch('ar-2', 'approved'))]);

  it('writes a new approval onto the open chat row, on whichever page holds it', () => {
    const data = pages([node('d-1')], [node('d-2')]);
    const next = withLiveRowState(data, 'd-2', waiting);
    expect(next?.pages[1].dialogs[0].pendingApproval).toEqual({ id: 'ar-2' });
    expect(next?.pages[0]).toBe(data.pages[0]);
  });

  it('clears the approval once it is resolved', () => {
    const data = pages([node('d-1', { pendingApproval: { id: 'ar-2', approvalType: 'ADMIN' } })]);
    expect(withLiveRowState(data, 'd-1', settled)?.pages[0].dialogs[0].pendingApproval).toBeNull();
  });

  it('marks the row working while Mingo answers', () => {
    const next = withLiveRowState(pages([node('d-1')]), 'd-1', liveRowState('streaming', []));
    expect(next?.pages[0].dialogs[0].streamState).toBe('STREAMING');
  });

  it('keeps the server record of the same request', () => {
    const data = pages([node('d-1', { pendingApproval: { id: 'ar-2', approvalType: 'ADMIN' } })]);
    expect(withLiveRowState(data, 'd-1', waiting)).toBe(data);
  });

  it('returns the same data when the row already says the same', () => {
    const data = pages([node('d-1')]);
    expect(withLiveRowState(data, 'd-1', settled)).toBe(data);
    expect(withLiveRowState(data, 'missing', waiting)).toBe(data);
    expect(withLiveRowState(undefined, 'd-1', settled)).toBeUndefined();
  });
});
