import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ChatType } from '../constants';
import { ticketService } from '../services';
import type { MessagePage } from '../services/ticket-service.types';

const ticketDialogMessagesQueryKey = (dialogId: string | null, chatType: ChatType) =>
  ['ticket-dialog-messages', dialogId, chatType] as const;

export function useTicketMessages(dialogId: string | null, chatType: ChatType) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!dialogId) return;
    queryClient.invalidateQueries({ queryKey: ticketDialogMessagesQueryKey(dialogId, chatType) });
  }, [dialogId, chatType, queryClient]);

  const messagesQuery = useInfiniteQuery({
    queryKey: ticketDialogMessagesQueryKey(dialogId, chatType),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }): Promise<MessagePage> => {
      if (!dialogId) {
        return { messages: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } };
      }

      return ticketService.fetchMessages({
        dialogId,
        chatType,
        cursor: pageParam,
        limit: 50,
        sortField: 'createdAt',
        sortDirection: 'DESC',
      });
    },
    getNextPageParam: (lastPage: MessagePage) => {
      return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!dialogId,
    staleTime: 30 * 1000,
    // Back online is not the moment to refetch loaded pages:
    // `TicketDialogSubscription` does, once the live tail's replay is in
    // (`caughtUpCount`). A first load that failed still retries: its tail opened
    // as a first consumer, which never moves `caughtUpCount`.
    refetchOnReconnect: query => query.state.data === undefined,
  });

  return {
    rawPages: messagesQuery.data?.pages,
    dataUpdatedAt: messagesQuery.dataUpdatedAt,
    isLoading: messagesQuery.isLoading,
    isFetched: messagesQuery.isFetched,
    /** True once a fetch completed AFTER this mount - i.e. the pages are fresh, not
     *  the previous visit's cache. The JetStream consumer's start seq must come from
     *  fresh pages: derived from the cache it resumes before what arrived while the
     *  user was away and replays it beside the persisted rows (duplicate messages on
     *  re-entry). */
    isFetchedAfterMount: messagesQuery.isFetchedAfterMount,
    hasNextPage: messagesQuery.hasNextPage ?? false,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
    fetchNextPage: messagesQuery.fetchNextPage,
    /** Re-fetch the loaded pages. */
    refetch: messagesQuery.refetch,
    error: messagesQuery.error?.message || null,
  };
}
