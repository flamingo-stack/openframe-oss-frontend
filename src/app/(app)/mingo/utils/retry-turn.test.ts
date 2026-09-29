import type { UnifiedChatMessage } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { describe, expect, it } from 'vitest';
import type { ProcessedMessage } from '../hooks/use-mingo-chat';
import { findRetryableTurn, withRetryAction } from './retry-turn';

const TIMESTAMP = new Date('2026-09-29T12:00:00Z');
const ERROR = { type: 'error' as const, title: 'AI response error', details: 'request timed out' };
const PARTIAL = { type: 'text' as const, text: 'Checking the policy' };
const CONTEXT = [{ type: 'POLICY', id: 'p-1', label: 'Disk policy' }];

function row(fields: Partial<ProcessedMessage> & Pick<ProcessedMessage, 'id' | 'role' | 'content'>): ProcessedMessage {
  return { name: 'Mingo', timestamp: TIMESTAMP, ...fields } as ProcessedMessage;
}

const prompt = row({ id: 'user-1', role: 'user', content: 'Why is this policy failing?', contextItems: CONTEXT });
const failed = row({ id: 'assistant-1', role: 'assistant', content: [PARTIAL, ERROR] });

describe('findRetryableTurn', () => {
  it('returns the last user turn when the latest reply ends on an error', () => {
    expect(findRetryableTurn([prompt, failed])).toEqual({
      failedMessageId: 'assistant-1',
      prompt: 'Why is this policy failing?',
      contextItems: CONTEXT,
    });
  });

  it('ignores hidden rows on both sides of the failed turn', () => {
    const directive = row({ id: 'user-2', role: 'user', content: 'continue', hidden: true });
    const hiddenTail = row({ id: 'assistant-2', role: 'assistant', content: 'ok', hidden: true });

    expect(findRetryableTurn([prompt, directive, failed, hiddenTail])?.prompt).toBe('Why is this policy failing?');
  });

  it('offers nothing when the error is not the end of the reply', () => {
    const recovered = row({ id: 'assistant-1', role: 'assistant', content: [ERROR, PARTIAL] });

    expect(findRetryableTurn([prompt, recovered])).toBeNull();
  });

  it('offers nothing for an older failure the user already moved past', () => {
    const next = row({ id: 'user-2', role: 'user', content: 'Never mind' });

    expect(findRetryableTurn([prompt, failed, next])).toBeNull();
  });

  it('offers nothing when there is no user turn to resend', () => {
    expect(findRetryableTurn([failed])).toBeNull();
  });
});

describe('withRetryAction', () => {
  it('appends the retry token after the error without touching the source row', () => {
    const segments = [PARTIAL, ERROR];
    const message = { id: 'assistant-1', role: 'assistant', content: '', segments } as UnifiedChatMessage;

    const decorated = withRetryAction(message);

    expect(decorated.segments).toEqual([PARTIAL, ERROR, { type: 'text', text: '@retry:turn' }]);
    expect(message.segments).toBe(segments);
    expect(segments).toHaveLength(2);
  });
});
