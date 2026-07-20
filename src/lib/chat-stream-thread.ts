/**
 * Shared shape bridge between the app's legacy chat `Message` (content:
 * string | MessageSegment[]) and the lib master reducer's
 * `UnifiedChatMessage` (content: string, segments?: MessageSegment[]).
 *
 * Phase 4 of the chat unification: the lib's `createChatDialogStore`
 * reducers own ALL message accumulation; the app stores keep only a
 * converted read-mirror. Conversion is cached BIDIRECTIONALLY by object
 * identity so the reducer's referential-stability contract survives the
 * round-trip — an untouched reducer message always converts back to the
 * SAME app message instance, which is what keeps the per-message React
 * memoization (and the history merge's reference reuse) intact.
 */

import {
  type Message as ChatMessage,
  extractIncompleteMessageState,
  type MessageSegment,
} from '@flamingo-stack/openframe-frontend-core';
import type {
  AssistantType,
  InitializeExtras,
  UnifiedChatMessage,
} from '@flamingo-stack/openframe-frontend-core/components/chat';

export interface ThreadIdentityDefaults {
  assistantName?: string;
  assistantType?: AssistantType;
}

const toUnifiedCache = new WeakMap<object, UnifiedChatMessage>();
const toAppCache = new WeakMap<object, ChatMessage>();

/** App `Message` → reducer `UnifiedChatMessage` (segments field). */
export function toUnifiedMessage(message: ChatMessage): UnifiedChatMessage {
  const cached = toUnifiedCache.get(message);
  if (cached) return cached;

  const { content, ...rest } = message;
  const unified = (Array.isArray(content)
    ? { ...rest, content: '', segments: content }
    : { ...rest, content: content ?? '' }) as unknown as UnifiedChatMessage;

  toUnifiedCache.set(message, unified);
  // Round-trip stability: reading this row back yields the ORIGINAL object.
  toAppCache.set(unified, message);
  return unified;
}

/** Reducer `UnifiedChatMessage` → app `Message` (content array). Rows the
 *  reducer created itself (turn bubbles, participant rows) get the side's
 *  assistant identity + a stable timestamp stamped at first conversion. */
export function fromUnifiedMessage(unified: UnifiedChatMessage, defaults: ThreadIdentityDefaults): ChatMessage {
  const cached = toAppCache.get(unified);
  if (cached) return cached;

  const { segments, content, ...rest } = unified as UnifiedChatMessage & {
    segments?: MessageSegment[];
  };
  const source = rest as Partial<ChatMessage>;
  const message = {
    ...rest,
    content: (segments ?? content ?? '') as ChatMessage['content'],
    timestamp: source.timestamp ?? new Date(),
    ...(unified.role === 'assistant'
      ? {
          name: unified.name ?? defaults.assistantName,
          assistantType: source.assistantType ?? defaults.assistantType,
        }
      : {}),
  } as ChatMessage;

  toAppCache.set(unified, message);
  toUnifiedCache.set(message, unified);
  return message;
}

/**
 * Incomplete-turn tail of a hydrated thread → the reducer's
 * `initializeWithState` extras (accumulator seed: pending approvals +
 * executing tools + trailing segments). Collects the trailing ASSISTANT
 * run (consecutive assistant rows), exactly like the pre-Phase-4 per-side
 * `incompleteState` memos did.
 */
export function computeIncompleteTailState(messages: readonly ChatMessage[]): InitializeExtras | undefined {
  const tail: MessageSegment[] = [];
  let lastAssistantId = '';
  let lastAssistantTimestamp = new Date();

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') break;
    if (!lastAssistantId) {
      lastAssistantId = msg.id;
      lastAssistantTimestamp = msg.timestamp || new Date();
    }
    if (Array.isArray(msg.content)) {
      tail.unshift(...msg.content);
    } else if (typeof msg.content === 'string' && msg.content) {
      tail.unshift({ type: 'text', text: msg.content } as MessageSegment);
    }
  }

  if (!tail.length || !lastAssistantId) return undefined;

  return (
    extractIncompleteMessageState({
      id: lastAssistantId,
      role: 'assistant',
      content: tail,
      name: 'assistant',
      timestamp: lastAssistantTimestamp,
    } as Parameters<typeof extractIncompleteMessageState>[0]) ?? undefined
  );
}
