import { describe, expect, it } from 'vitest';
import { annotateApprovalChunk, annotateMessageData, formatCommandReview } from './command-review';

const REVIEW = {
  decision: 'SOFT_DENY',
  approvalLevel: 'ASK_TECHNICIAN',
  policyLevel: 'ALLOW',
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
      'Disable Defender · AI review · Soft deny: Security Weaken → ASK_TECHNICIAN (policy: ALLOW) — turns off real-time protection [MANAGE_ANTIVIRUS]',
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

    expect(annotated?.toolCalls[0]?.toolExplanation).toContain('AI review · Soft deny: Security Weaken');
  });

  it('names the fallback when the operation is not in the policy', () => {
    const summary = formatCommandReview({
      decision: 'FALLBACK',
      approvalLevel: 'ASK_TECHNICIAN',
      policyLevel: 'ASK_TECHNICIAN',
      operationCodes: ['UNKNOWN'],
      matchedRules: [],
      reason: 'prints hey',
    });

    expect(summary).toBe('AI review · Fallback (operation not in policy) → ASK_TECHNICIAN — prints hey [UNKNOWN]');
  });

  it('names the policy level when no rule raised it', () => {
    const summary = formatCommandReview({
      decision: 'POLICY',
      approvalLevel: 'ASK_USER',
      policyLevel: 'ASK_USER',
      operationCodes: ['DELETE_FILES'],
      matchedRules: [],
      reason: 'deletes a temp file',
    });

    expect(summary).toBe('AI review · Policy → ASK_USER — deletes a temp file [DELETE_FILES]');
  });

  it('says the review failed when the classifier failed', () => {
    const summary = formatCommandReview({
      decision: 'CLASSIFIER_FAILURE',
      approvalLevel: 'ASK_TECHNICIAN',
      policyLevel: 'ASK_TECHNICIAN',
      operationCodes: [],
      matchedRules: [],
      reason: 'The command review failed, so the policy fallback level applies.',
    });

    expect(summary).toBe(
      'AI review · Review failed (fallback) → ASK_TECHNICIAN — The command review failed, so the policy fallback level applies.',
    );
  });

  it('falls back to the rules when the review has no decision', () => {
    const summary = formatCommandReview({
      operationCodes: ['CHECK_PERFORMANCE'],
      matchedRules: [],
      reason: 'reads CPU',
    });

    expect(summary).toBe('AI review · no block rule — reads CPU [CHECK_PERFORMANCE]');
  });
});
