import type { ChatMessage, ChatPart, ChatToolPart } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { describe, expect, it } from 'vitest';
import {
  DISPLAY_APPROVAL_TYPES,
  extractPendingApprovals,
  findLatestPendingApprovalId,
  isCompactingTail,
  stripPendingApprovals,
} from './chat-history';

const assistant = (id: string, ...parts: ChatPart[]): ChatMessage => ({ id, role: 'assistant', parts });

const text: ChatPart = { type: 'text', text: 'This needs your go-ahead.' };

/** A card of one: no batch. */
function single(id: string, status: 'pending' | 'approved' | 'rejected' = 'pending', tier = 'ADMIN'): ChatToolPart {
  const base = { type: 'dynamic-tool', toolName: 'command', toolCallId: id, input: {} } as const;
  const approval = { id, descriptor: { approvalType: tier } };
  if (status === 'pending') return { ...base, state: 'approval-requested', approval };
  if (status === 'approved') return { ...base, state: 'approval-responded', approval: { ...approval, approved: true } };
  return { ...base, state: 'output-denied', approval: { ...approval, approved: false } };
}

/** One row of a batch: the batch is what the backend knows. */
function row(toolCallId: string, batchId: string, status: 'pending' | 'approved' = 'pending'): ChatToolPart {
  const base = { type: 'dynamic-tool', toolName: 'run_script', toolCallId, input: {} } as const;
  const approval = { id: toolCallId, descriptor: { approvalType: 'ADMIN', batchId } };
  return status === 'pending'
    ? { ...base, state: 'approval-requested', approval }
    : { ...base, state: 'approval-responded', approval: { ...approval, approved: true } };
}

describe('findLatestPendingApprovalId', () => {
  it('names a card of one by its id and a batch by the batch', () => {
    expect(findLatestPendingApprovalId([assistant('a', single('r-1'))])).toBe('r-1');
    expect(findLatestPendingApprovalId([assistant('a', row('run-1', 'batch-1'))])).toBe('batch-1');
  });

  it('takes the newest, and nothing once they are answered', () => {
    const messages = [assistant('a', single('r-1')), assistant('b', row('run-1', 'batch-1'), text)];
    expect(findLatestPendingApprovalId(messages)).toBe('batch-1');
    expect(findLatestPendingApprovalId([assistant('a', single('r-1', 'approved'), text)])).toBeUndefined();
  });
});

describe('extractPendingApprovals and stripPendingApprovals', () => {
  it('lifts a pending card of one into the footer, and the two lists are exact complements', () => {
    const card = single('r-1');
    const messages = [assistant('a', text, card)];

    expect(extractPendingApprovals(messages)).toEqual([card]);
    expect(stripPendingApprovals(messages)[0].parts).toEqual([text]);
  });

  it('leaves a batch in its turn: a card of several rows', () => {
    const rows = [row('run-1', 'batch-1'), row('run-2', 'batch-1')];
    const messages = [assistant('a', text, ...rows)];

    expect(extractPendingApprovals(messages)).toEqual([]);
    expect(stripPendingApprovals(messages)[0].parts).toEqual([text, ...rows]);
  });

  it("does not offer a card of a tier this operator does not answer, and leaves it to the lib's tier rule", () => {
    const card = single('r-1', 'pending', 'USER');
    const messages = [assistant('a', text, card)];

    expect(DISPLAY_APPROVAL_TYPES).not.toContain('USER');
    expect(extractPendingApprovals(messages)).toEqual([]);
    expect(stripPendingApprovals(messages)[0].parts).toEqual([text, card]);
  });

  it('does not surface a stale pending copy of a request resolved anywhere', () => {
    const pending = assistant('a', single('r-1'));
    expect(extractPendingApprovals([pending, assistant('b', single('r-1', 'rejected'))])).toEqual([]);
    expect(extractPendingApprovals([pending], { 'r-1': 'approved' })).toEqual([]);
    expect(extractPendingApprovals([pending], { 'r-1': 'pending' })).toHaveLength(1);
  });

  it('shows a card held by two bubbles once, the first, and drops a bubble left with nothing', () => {
    const first = assistant('a', text, single('r-1', 'rejected'));
    const second = assistant('b', single('r-1', 'rejected'));

    expect(stripPendingApprovals([first, second])).toEqual([first]);
  });

  it('keeps a batch whole in the first bubble that holds it', () => {
    const first = assistant('a', row('run-1', 'batch-1', 'approved'), row('run-2', 'batch-1', 'approved'));
    const copy = assistant('b', text, row('run-1', 'batch-1', 'approved'));

    expect(stripPendingApprovals([first, copy])).toEqual([first, assistant('b', text)]);
  });

  it('shows the answered copy of a batch, whichever bubble holds it: an answer lands on the newest copy only', () => {
    const stale = assistant('a', text, row('run-1', 'batch-1'));
    const answered = assistant('b', row('run-1', 'batch-1', 'approved'));

    expect(stripPendingApprovals([stale, answered])).toEqual([assistant('a', text), answered]);
  });

  it('hands back the same message when it changes nothing, for the memo downstream', () => {
    const message = assistant('a', text, row('run-1', 'batch-1'));
    expect(stripPendingApprovals([message])[0]).toBe(message);
  });
});

describe('isCompactingTail', () => {
  const compaction = (status: 'started' | 'completed'): ChatPart => ({
    type: 'data-context-compaction',
    data: { status },
  });

  it('is true while the last thing in the thread is a compaction still running', () => {
    expect(isCompactingTail([assistant('a', text, compaction('started'))])).toBe(true);
  });

  it('is false once it completed, once something follows it, and on an empty thread', () => {
    expect(isCompactingTail([assistant('a', compaction('completed'))])).toBe(false);
    expect(isCompactingTail([assistant('a', compaction('started'), text)])).toBe(false);
    expect(isCompactingTail([])).toBe(false);
    expect(isCompactingTail(undefined)).toBe(false);
  });
});
