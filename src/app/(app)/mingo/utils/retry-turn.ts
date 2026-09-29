import type { ChatContextItem, UnifiedChatMessage } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { ProcessedMessage } from '../hooks/use-mingo-chat';

/**
 * Retry for a Mingo turn that ended on an error chunk (timeout, overloaded).
 *
 * The lib renders the error segment as a bare expand/collapse banner and its
 * `ErrorSegment` has no action slot, so the host places the Retry button through
 * the one host-rendered slot a bubble has: `renderMention`. The failed bubble
 * gets one extra text segment holding `RETRY_TOKEN`, which the lib parses as an
 * inline mention and hands to `renderMingoMention`. Move this onto the error
 * segment itself once the lib gives it an action.
 */
export const RETRY_MARKER = 'retry';
const RETRY_TOKEN = `@${RETRY_MARKER}:turn`;

export interface RetryableTurn {
  /** Id of the assistant row that ended on the error. */
  failedMessageId: string;
  /** The user turn to send again. */
  prompt: string;
  contextItems?: ChatContextItem[];
}

/**
 * The turn to retry, or null. Only the LATEST visible row counts: an error in
 * the middle of the thread was already followed by another turn, so resending
 * its prompt would repeat a question the user moved past.
 */
export function findRetryableTurn(messages: readonly ProcessedMessage[]): RetryableTurn | null {
  const visible = messages.filter(message => !message.hidden);
  const last = visible.at(-1);
  if (last?.role !== 'assistant' || !Array.isArray(last.content)) return null;
  if (last.content.at(-1)?.type !== 'error') return null;

  const userTurn = [...visible].reverse().find(message => message.role === 'user');
  if (typeof userTurn?.content !== 'string' || !userTurn.content.trim()) return null;

  return {
    failedMessageId: last.id,
    prompt: userTurn.content,
    contextItems: userTurn.contextItems?.length ? userTurn.contextItems : undefined,
  };
}

/** The failed bubble with the Retry token appended after its error segment. */
export function withRetryAction(message: UnifiedChatMessage): UnifiedChatMessage {
  return { ...message, segments: [...(message.segments ?? []), { type: 'text', text: RETRY_TOKEN }] };
}
