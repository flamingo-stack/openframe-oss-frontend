import type { Message as ChatMessage } from '@flamingo-stack/openframe-frontend-core';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { TicketsPage } from '../services/ticket-service.types';
import { dialogsQueryKeys } from './query-keys';

/**
 * The END USER's rows carry this `authorType` on both the persisted history
 * (`useHistoricalMessages`) and the live direct-message intercept
 * (`useSideChunkProcessor`); technician rows are `'admin'`, assistants `'fae'`.
 */
const CLIENT_AUTHOR_TYPE = 'user';

/**
 * Id of the newest row the end user wrote, or null while none is loaded.
 *
 * The technicians' unread counter (`Ticket.unreadMessageCount`) only ever counts
 * these, so a change in this id is the one signal that the read mark may be
 * behind: a client message now on screen - with the history, or live - that
 * arrived since the last mark. Technician and assistant rows do not move it.
 */
export function lastClientMessageId(messages: readonly Pick<ChatMessage, 'id' | 'authorType'>[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.authorType === CLIENT_AUTHOR_TYPE) return message.id;
  }
  return null;
}

/**
 * Zero the ticket's unread-message badge in every cached board column and table page.
 *
 * Written rather than invalidated: invalidation only marks those queries stale while
 * they are unmounted behind the ticket page, so navigating back paints the cached pages
 * and the card keeps its badge until the column's 15s poll. The count is known to be
 * zero here. Caches that do not hold the ticket unread are returned as-is (same
 * reference), so nothing re-renders for them.
 */
export function clearCachedUnreadMessages(queryClient: QueryClient, ticketId: string): void {
  queryClient.setQueriesData<InfiniteData<TicketsPage>>({ queryKey: dialogsQueryKeys.all }, prev => {
    if (!prev?.pages?.some(page => page.dialogs.some(d => d.id === ticketId && d.unreadMessageCount))) return prev;
    return {
      ...prev,
      pages: prev.pages.map(page => ({
        ...page,
        dialogs: page.dialogs.map(d => (d.id === ticketId ? { ...d, unreadMessageCount: 0 } : d)),
      })),
    };
  });
}
