'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { ticketService } from '../services';
import { clearCachedUnreadMessages } from '../utils/client-chat-read';
import { dialogsQueryKeys } from '../utils/query-keys';

/**
 * Resets the technicians' shared unread counter of one client-chat dialog
 * (`markDialogMessagesRead`) and clears the ticket's badge in the cached board/table
 * pages - before the request (the user is looking at the chat, so the badge is wrong
 * the moment it is on screen) and again after it (a column poll landing in between
 * would have repainted the stale count).
 *
 * One request per dialog at a time; a call made while one is in flight runs once more
 * after it, because a client message that landed between the server's reset and the
 * response would otherwise stay counted although it is on screen.
 *
 * No toast on failure, on the same grounds as `useMarkEntityNotificationsRead`: the user
 * never triggered this, and the next client message or attention edge retries. The
 * failure is logged and the lists invalidated so the optimistic zero does not outlive
 * a rejected write.
 */
export function useMarkDialogMessagesRead() {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(new Set<string>());
  const rerunRef = useRef(new Set<string>());

  return useCallback(
    async (dialogId: string, ticketId: string): Promise<void> => {
      if (inFlightRef.current.has(dialogId)) {
        rerunRef.current.add(dialogId);
        return;
      }
      inFlightRef.current.add(dialogId);
      try {
        do {
          rerunRef.current.delete(dialogId);
          clearCachedUnreadMessages(queryClient, ticketId);
          try {
            await ticketService.markDialogMessagesRead(dialogId);
            clearCachedUnreadMessages(queryClient, ticketId);
          } catch (err) {
            console.warn('[Tickets] markDialogMessagesRead failed:', dialogId, err);
            void queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
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
