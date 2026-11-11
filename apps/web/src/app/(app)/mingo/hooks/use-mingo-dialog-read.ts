'use client';

import { type InfiniteData, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { isSessionActive, PRESENCE_IDLE_MS, subscribeAttention } from '@/lib/session-activity';
import { ticketService } from '../../tickets/services';
import { extractGraphQlData } from '../../tickets/utils/graphql';
import { GET_MINGO_DIALOG_UNREAD_QUERY } from '../queries/dialogs-queries';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { DialogNode, DialogResponse } from '../types';
import { type MingoDialogsPage, withUnreadCount } from '../utils/dialog-row-status';
import { mingoDialogQueryKeys } from '../utils/query-keys';

/** The two ids of one chat: `id` is the Relay id the API takes, `dialogId` the raw one the list rows are matched on. */
type DialogRef = Pick<DialogNode, 'id' | 'dialogId'>;

function writeUnreadCount(queryClient: QueryClient, dialogId: string, unreadMessageCount: number): void {
  queryClient.setQueriesData<InfiniteData<MingoDialogsPage>>({ queryKey: mingoDialogQueryKeys.lists }, data =>
    withUnreadCount(data, dialogId, unreadMessageCount),
  );
}

/**
 * True for a Mingo chat the signed-in admin created: the only chat whose unread
 * replies are theirs to read. Both ids must be known. Without that guard a
 * client-owned dialog (no `userId`) before the user has loaded would pass as "the
 * same nobody", and marking it read resets the counter all technicians share.
 */
export function isOwnMingoDialog(
  dialog: Pick<DialogNode, 'owner'> | null | undefined,
  currentUserId: string | undefined,
): boolean {
  const ownerId = dialog?.owner?.userId;
  return !!ownerId && !!currentUserId && ownerId === currentUserId;
}

/**
 * Marks a Mingo chat read for its owner (`markDialogMessagesRead`, the mutation the
 * client chat uses: on a Mingo chat it zeroes the owner's unread replies) and keeps
 * the chat list's caches in step.
 *
 * The row is zeroed before the request, and written again from the answer. A list
 * read still in flight then was answered before the write and would put the old count
 * back, where it would show the moment the user left the chat, so those reads are
 * dropped first; the next poll asks again. Only lists that already hold rows: dropping
 * a list's first load would leave it loading until that poll.
 *
 * One request per chat at a time; a call made while one is in flight runs once more
 * after it, since a reply that ended in between is on screen and still counted.
 *
 * Silent on failure, as the client chat's read mark is: the user never asked for it.
 * The lists are refetched so the zero does not outlive a refused write.
 */
export function useMarkMingoDialogRead(): (dialog: DialogRef) => Promise<void> {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(new Set<string>());
  const rerunRef = useRef(new Set<string>());

  return useCallback(
    async ({ id, dialogId }: DialogRef): Promise<void> => {
      if (inFlightRef.current.has(dialogId)) {
        rerunRef.current.add(dialogId);
        return;
      }
      inFlightRef.current.add(dialogId);
      try {
        do {
          rerunRef.current.delete(dialogId);
          writeUnreadCount(queryClient, dialogId, 0);
          try {
            const unreadMessageCount = await ticketService.markDialogMessagesRead(id);
            await queryClient.cancelQueries({
              queryKey: mingoDialogQueryKeys.lists,
              predicate: query => query.state.data !== undefined,
            });
            writeUnreadCount(queryClient, dialogId, unreadMessageCount);
          } catch (err) {
            console.warn('[Mingo] markDialogMessagesRead failed:', dialogId, err);
            void queryClient.invalidateQueries({ queryKey: mingoDialogQueryKeys.lists });
            break;
          }
        } while (rerunRef.current.has(dialogId));
      } finally {
        inFlightRef.current.delete(dialogId);
        rerunRef.current.delete(dialogId);
      }
    },
    [queryClient],
  );
}

/**
 * Reads one chat's unread replies again and writes them onto its list row. For the
 * open chat whose reply ended behind a page: its stream said so, and nothing else
 * would tell the list before its next poll. A failure is left to that poll.
 */
export async function refreshMingoDialogUnread(queryClient: QueryClient, id: string): Promise<void> {
  try {
    const response = await apiClient.post<DialogResponse>('/chat/graphql', {
      query: GET_MINGO_DIALOG_UNREAD_QUERY,
      variables: { id },
    });
    const dialog = extractGraphQlData(response).dialog;
    if (dialog) writeUnreadCount(queryClient, dialog.dialogId, dialog.unreadMessageCount ?? 0);
  } catch (err) {
    console.warn('[Mingo] unread refresh failed:', id, err);
  }
}

interface UseMingoDialogAutoReadOptions {
  /** The open chat's own record, or null until it has loaded. */
  dialog: DialogNode | null;
  currentUserId: string | undefined;
  /** The open chat's thread is in front of the user (the provider's `onScreen`). */
  onScreen: boolean;
}

/**
 * Keeps the open chat's unread replies in step with what its owner has seen.
 *
 * On screen, the chat is marked read twice over: once each time it comes on screen
 * (opened from the list, by a link, by a reload, or shown again from behind a page),
 * and once for every reply that ends there, which the backend has counted by then
 * (it counts before the stream's end reaches the client). Sending needs no mark: the
 * backend zeroes the count itself.
 *
 * Both wait for a person: a mark is owed until the session is present
 * (`PRESENCE_IDLE_MS`, the rule a Mingo reply's notification is auto-read by) and is
 * paid on the next attention edge otherwise. Read state is shared with the user's
 * other tabs and devices, so a laptop left open must not clear it.
 *
 * Off screen (the tail runs on behind a full-screen page) nothing is marked; a reply
 * that ends there is read back from the server, so its row shows the new reply.
 *
 * Only for a chat the user owns (`isOwnMingoDialog`).
 */
export function useMingoDialogAutoRead({ dialog, currentUserId, onScreen }: UseMingoDialogAutoReadOptions): void {
  const queryClient = useQueryClient();
  const markRead = useMarkMingoDialogRead();

  const id = dialog?.id ?? null;
  const dialogId = dialog?.dialogId ?? null;
  const own = isOwnMingoDialog(dialog, currentUserId);
  const replyRunning = useMingoMessagesStore(s =>
    dialogId ? (s.phaseByDialog.get(dialogId) ?? 'idle') !== 'idle' : false,
  );

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

    if (!id || !dialogId || !own || !onScreen) {
      periodRef.current = null;
      owedRef.current = null;
      if (id && own && replyEnded) void refreshMingoDialogUnread(queryClient, id);
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
    void markRead({ id, dialogId });
  }, [id, dialogId, own, onScreen, replyRunning, attentionEdge, markRead, queryClient]);
}
