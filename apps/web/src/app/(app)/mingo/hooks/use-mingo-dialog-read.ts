'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSessionActive, PRESENCE_IDLE_MS, subscribeAttention } from '@/lib/session-activity';
import { ticketService } from '../../tickets/services';
import { noteMingoDialogRead, useMingoDialogRowsStore } from '../stores/mingo-dialog-rows-store';

/** Reads one chat's record again; its answer is noted on the chat's row (`postMingoGraphql`). */
type ReadDialogAgain = (dialogId: string) => Promise<unknown>;

/**
 * True for a Mingo chat the signed-in admin created: the only chat whose unread replies are theirs to read. Both ids
 * must be known. Without that guard a client-owned dialog (no owner user) before the user has loaded would pass as "the
 * same nobody", and marking it read resets the counter all technicians share.
 */
export function isOwnMingoDialog(ownerUserId: string | undefined, currentUserId: string | undefined): boolean {
  return !!ownerUserId && !!currentUserId && ownerUserId === currentUserId;
}

/**
 * Marks a Mingo chat read for its owner (`markDialogMessagesRead`, the mutation the client chat uses: on a Mingo chat
 * it zeroes the owner's unread replies) and keeps the chat's row in step.
 *
 * The row is zeroed before the request, and written again from the answer. Both writes stamp the row
 * (`noteMingoDialogRead`), so a list read that was in flight then, answered before the write, cannot put the old count
 * back where it would show the moment the user left the chat.
 *
 * One request per chat at a time; a call made while one is in flight runs once more after it, since a reply that ended
 * in between is on screen and still counted.
 *
 * Silent on failure, as the client chat's read mark is: the user never asked for it. The chat's record is read again so
 * the zero does not outlive a refused write.
 */
export function useMarkMingoDialogRead(
  readDialogAgain: ReadDialogAgain,
): (dialog: { nodeId: string; dialogId: string }) => Promise<void> {
  const inFlightRef = useRef(new Set<string>());
  const rerunRef = useRef(new Set<string>());

  return useCallback(
    async ({ nodeId, dialogId }): Promise<void> => {
      if (inFlightRef.current.has(dialogId)) {
        rerunRef.current.add(dialogId);
        return;
      }
      inFlightRef.current.add(dialogId);
      try {
        do {
          rerunRef.current.delete(dialogId);
          noteMingoDialogRead(dialogId, 0);
          try {
            noteMingoDialogRead(dialogId, await ticketService.markDialogMessagesRead(nodeId));
          } catch (err) {
            console.warn('[Mingo] markDialogMessagesRead failed:', dialogId, err);
            void readDialogAgain(dialogId).catch(() => undefined);
            break;
          }
        } while (rerunRef.current.has(dialogId));
      } finally {
        inFlightRef.current.delete(dialogId);
        rerunRef.current.delete(dialogId);
      }
    },
    [readDialogAgain],
  );
}

interface UseMingoDialogAutoReadOptions {
  /** The open chat, or null. */
  dialogId: string | null;
  currentUserId: string | undefined;
  /** The open chat's thread is in front of the user (the provider's `onScreen`). */
  onScreen: boolean;
  /** Mingo is answering in the open chat (the engine's phase is not idle). */
  replyRunning: boolean;
  readDialogAgain: ReadDialogAgain;
}

/**
 * Keeps the open chat's unread replies in step with what its owner has seen.
 *
 * On screen, the chat is marked read twice over: once each time it comes on screen (opened from the list, by a link,
 * by a reload, or shown again from behind a page), and once for every reply that ends there, which the backend has
 * counted by then (it counts before the stream's end reaches the client). Sending needs no mark: the backend zeroes the
 * count itself.
 *
 * Both wait for a person: a mark is owed until the session is present (`PRESENCE_IDLE_MS`, the rule a Mingo reply's
 * notification is auto-read by) and is paid on the next attention edge otherwise. Read state is shared with the user's
 * other tabs and devices, so a laptop left open must not clear it.
 *
 * Off screen (the tail runs on behind a full-screen page) nothing is marked; a reply that ends there is read back from
 * the server, so its row shows the new reply.
 *
 * Only for a chat the user owns (`isOwnMingoDialog`), and only once its row is known: the row holds the id the mutation
 * takes and the owner, and a chat reached by link has neither until its record has answered.
 */
export function useMingoDialogAutoRead({
  dialogId,
  currentUserId,
  onScreen,
  replyRunning,
  readDialogAgain,
}: UseMingoDialogAutoReadOptions): void {
  const markRead = useMarkMingoDialogRead(readDialogAgain);
  const nodeId = useMingoDialogRowsStore(s => (dialogId ? s.rows.get(dialogId)?.nodeId : undefined)) ?? null;
  const ownerUserId = useMingoDialogRowsStore(s => (dialogId ? s.rows.get(dialogId)?.ownerUserId : undefined));
  const own = isOwnMingoDialog(ownerUserId, currentUserId);

  // The edge the other auto-readers re-run on: focus edges, and input resuming.
  const [attentionEdge, setAttentionEdge] = useState(0);
  useEffect(() => subscribeAttention(() => setAttentionEdge(edge => edge + 1)), []);

  const lastRunRef = useRef<{ dialogId: string | null; replyRunning: boolean }>({
    dialogId: null,
    replyRunning: false,
  });
  /** The chat whose current on-screen period has been counted. */
  const periodRef = useRef<string | null>(null);
  /** The chat a read mark is owed for. */
  const owedRef = useRef<string | null>(null);

  // attentionEdge is the re-run trigger, not read in the body.
  useEffect(() => {
    const last = lastRunRef.current;
    const replyEnded = last.dialogId === dialogId && last.replyRunning && !replyRunning;
    lastRunRef.current = { dialogId, replyRunning };

    if (!nodeId || !dialogId || !own || !onScreen) {
      periodRef.current = null;
      owedRef.current = null;
      if (dialogId && own && replyEnded) void readDialogAgain(dialogId).catch(() => undefined);
      return;
    }

    if (periodRef.current !== dialogId) {
      periodRef.current = dialogId;
      owedRef.current = dialogId;
    }
    if (replyEnded) owedRef.current = dialogId;

    if (owedRef.current !== dialogId) return;
    if (!isSessionActive({ idleAfterMs: PRESENCE_IDLE_MS })) return;
    owedRef.current = null;
    void markRead({ nodeId, dialogId });
  }, [nodeId, dialogId, own, onScreen, replyRunning, attentionEdge, markRead, readDialogAgain]);
}
