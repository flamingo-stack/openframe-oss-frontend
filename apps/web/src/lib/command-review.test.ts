import { describe, expect, it } from 'vitest';
import { annotateApprovalChunk, annotateMessageData, formatCommandReview } from './command-review';

const REVIEW = {
  operationCodes: ['MANAGE_ANTIVIRUS'],
  matchedRules: [{ code: 'SECURITY_WEAKEN', label: 'Security Weaken' }],
  reason: 'turns off real-time protection',
};

function approvalChunk(approvalType: string) {
  return {
    type: 'APPROVAL_REQUEST',
    approvalType,
    approvalRequestId: 'req-1',
    toolCalls: [
      { toolExecutionRequestId: 'call-1', toolExplanation: 'Disable Defender', commandReview: REVIEW },
      { toolExecutionRequestId: 'call-2', toolExplanation: 'List processes' },
    ],
  };
}

describe('command review on the approval card', () => {
  it('appends the review to the explanation of a reviewed admin call', () => {
    const annotated = annotateApprovalChunk(approvalChunk('ADMIN'));

    expect(annotated.toolCalls.map(call => call.toolExplanation)).toEqual([
      'Disable Defender · AI review: Security Weaken — turns off real-time protection [MANAGE_ANTIVIRUS]',
      'List processes',
    ]);
  });

  it('leaves a client approval untouched', () => {
    const chunk = approvalChunk('CLIENT');

    expect(annotateApprovalChunk(chunk)).toBe(chunk);
  });

  it('leaves other chunk types untouched', () => {
    const chunk = { type: 'TEXT', text: 'hi' };

    expect(annotateApprovalChunk(chunk)).toBe(chunk);
  });

  it('annotates every approval inside a persisted message list', () => {
    const [annotated] = annotateMessageData([approvalChunk('ADMIN')]);

    expect(annotated?.toolCalls[0]?.toolExplanation).toContain('AI review: Security Weaken');
  });

  it('says no block rule matched when the list is empty', () => {
    const summary = formatCommandReview({
      operationCodes: ['CHECK_PERFORMANCE'],
      matchedRules: [],
      reason: 'reads CPU',
    });

    expect(summary).toBe('AI review: no block rule — reads CPU [CHECK_PERFORMANCE]');
  });
});
