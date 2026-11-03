import {
  approvalBatchIdOf,
  approvalIdOfPart,
  approvalStatusOf,
  type ChatMessage,
  type ChatToolPart,
  isToolPart,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { approvalDisplaysInline } from '@flamingo-stack/openframe-frontend-core/components/chat';

/** The approval tiers an operator of this app answers: another tier's card is not drawn for them until it resolves. */
export const DISPLAY_APPROVAL_TYPES: readonly string[] = ['CLIENT', 'ADMIN'];

/**
 * A card of one waiting on this operator: drawn by the sticky `pendingApprovals` footer, not in the flow. A batch stays in
 * its turn, and another tier's card stays where the lib's tier rule (`approvalDisplaysInline`) keeps it off screen.
 *
 * TODO(CU-17tkuw61kfy): only an old approval row with no tool list is a card of one (`message-decoder.ts`, the tenant's
 * one writer `BatchApprovalPauseService` always lists its tools, and every listed call is a batch's). With those rows goes
 * this, and the footer it feeds.
 */
function isPendingFooterCard(part: ChatToolPart): boolean {
  if (approvalStatusOf(part) !== 'pending' || approvalBatchIdOf(part) !== undefined) return false;
  const tier = 'approval' in part ? part.approval?.descriptor?.approvalType : undefined;
  return tier === undefined || approvalDisplaysInline(tier, DISPLAY_APPROVAL_TYPES);
}

// Newest-to-oldest scan for the latest pending approval (single or batch).
// Returns the id it is known by, or undefined if none. Used by send-message
// handlers to optimistically flip the active approval gate to `rejected` when
// the user interrupts, so the card resolves in the same frame as the
// user-message bubble (no flicker between the two updates).
export function findLatestPendingApprovalId(messages: readonly ChatMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const { parts } = messages[i];
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j];
      if (isToolPart(part) && approvalStatusOf(part) === 'pending') return approvalIdOfPart(part);
    }
  }
  return undefined;
}

export function extractPendingApprovals(
  messages: readonly ChatMessage[],
  resolvedStatuses?: Record<string, string | undefined>,
): ChatToolPart[] {
  // A request that is resolved anywhere — in the consumer's approval-status
  // map (realtime flipped it) or as a resolved part in any copy — must not
  // surface as a sticky pending card, even when a stale duplicate copy is still
  // `pending` (history re-process can resurrect one before the resolved
  // realtime copy in `[...storeMessages, ...realtimeOnly]`).
  const resolved = new Set<string>();
  if (resolvedStatuses) {
    for (const [id, status] of Object.entries(resolvedStatuses)) {
      if (status === 'approved' || status === 'rejected') resolved.add(id);
    }
  }
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolPart(part)) continue;
      const status = approvalStatusOf(part);
      const key = approvalIdOfPart(part);
      if (status !== null && status !== 'pending' && key) resolved.add(key);
    }
  }

  const seen = new Set<string>();
  const pending: ChatToolPart[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolPart(part) || !isPendingFooterCard(part)) continue;
      const key = approvalIdOfPart(part);
      if (key) {
        if (resolved.has(key) || seen.has(key)) continue;
        seen.add(key);
      }
      pending.push(part);
    }
  }
  return pending;
}

// Pending cards render via the sticky `pendingApprovals` prop; resolved ones
// stay inline so the outcome shows in the chat flow.
// Also dedupes approval cards by their id across bubbles (first bubble wins) —
// history and a realtime copy can both hold a card, so without dedupe a single
// rejected approval would render in every copy's bubble. An answer lands on the
// newest copy only, so a copy still pending never stands in for one that was
// answered. A batch is one card of several parts, so its rows in the one bubble
// that holds it all stay. Assistant bubbles that become empty after filter are
// dropped entirely to avoid orphan bubbles holding only a deduped card.
export function stripPendingApprovals<M extends ChatMessage>(messages: readonly M[]): M[] {
  const answeredIn = new Map<string, M>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolPart(part)) continue;
      const status = approvalStatusOf(part);
      const key = approvalIdOfPart(part);
      if (status !== null && status !== 'pending' && key && !answeredIn.has(key)) answeredIn.set(key, message);
    }
  }

  const result: M[] = [];
  const holderOf = new Map<string, M>();
  for (const message of messages) {
    const parts = message.parts.filter(part => {
      if (!isToolPart(part)) return true;
      if (isPendingFooterCard(part)) return false;
      const key = approvalIdOfPart(part);
      if (!key) return true;
      const answered = answeredIn.get(key);
      if (answered && answered !== message) return false;
      const holder = holderOf.get(key);
      if (holder && holder !== message) return false;
      holderOf.set(key, message);
      return true;
    });
    if (message.role === 'assistant' && parts.length === 0) continue;
    result.push(parts.length === message.parts.length ? message : { ...message, parts });
  }
  return result;
}

/** Whether a thread's last thing is a context compaction still running: it locks the composer. */
export function isCompactingTail(messages: readonly ChatMessage[] | undefined): boolean {
  const last = messages?.at(-1);
  if (last?.role !== 'assistant') return false;
  const tail = last.parts.at(-1);
  return tail?.type === 'data-context-compaction' && tail.data.status === 'started';
}
