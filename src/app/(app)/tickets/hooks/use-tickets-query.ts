'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { ticketService } from '../services';
import type { TicketsPage } from '../services/ticket-service.types';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import { type DialogsQueryParams, dialogsQueryKeys } from '../utils/query-keys';

const TICKETS_PAGE_SIZE = 20;

export function useTicketsQuery({
  archived,
  search,
  statusFilters,
  organizationIds,
  assigneeIds,
  tagIds,
  pageSize = TICKETS_PAGE_SIZE,
}: DialogsQueryParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusesQuery = useTicketStatusesQuery({ enabled: true });
  // The table filters by status id (selected ids, the archived id, or all
  // non-archived ids when nothing is selected).
  const statusIds = useMemo(() => {
    const snapshot = statusesQuery.data?.snapshot;
    if (archived) {
      const archivedId = snapshot?.find(s => s.kind === 'ARCHIVED')?.id;
      return archivedId ? [archivedId] : undefined;
    }
    if (statusFilters && statusFilters.length > 0) return statusFilters;
    return snapshot?.filter(s => s.kind !== 'ARCHIVED').map(s => s.id);
  }, [archived, statusFilters, statusesQuery.data]);

  // There is no enum fallback anymore: until the snapshot resolves ids the
  // query stays disabled, so a missing snapshot can't send an empty filter
  // that would leak archived tickets into the list.
  const waitingForStatusIds = !statusIds?.length;

  const query = useInfiniteQuery<TicketsPage, Error>({
    queryKey: dialogsQueryKeys.list({
      archived,
      search,
      statusFilters,
      statusIds,
      organizationIds,
      assigneeIds,
      tagIds,
      pageSize,
    }),
    enabled: !waitingForStatusIds,
    queryFn: async ({ pageParam }) => {
      return ticketService.fetchDialogs({
        statusIds: statusIds ?? [],
        search: search || undefined,
        organizationIds: organizationIds?.length ? organizationIds : undefined,
        assigneeIds: assigneeIds?.length ? assigneeIds : undefined,
        tagIds: tagIds?.length ? tagIds : undefined,
        cursor: pageParam as string | undefined,
        limit: pageSize,
      });
    },
    getNextPageParam: lastPage => (lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined),
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
    retryDelay: 1000,
  });

  // A failed snapshot fetch keeps the tickets query disabled, so surface that
  // error the same way — otherwise the list would just spin forever.
  const error = query.error ?? statusesQuery.error;

  useEffect(() => {
    if (error) {
      toast({
        title: 'Failed to Load Tickets',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const dialogs = useMemo(() => query.data?.pages.flatMap(page => page.dialogs) ?? [], [query.data?.pages]);

  const resetToFirstPage = useCallback(() => {
    queryClient.resetQueries({
      queryKey: dialogsQueryKeys.list({
        archived,
        search,
        statusFilters,
        statusIds,
        organizationIds,
        assigneeIds,
        tagIds,
        pageSize,
      }),
    });
  }, [queryClient, archived, search, statusFilters, statusIds, organizationIds, assigneeIds, tagIds, pageSize]);

  return {
    dialogs,
    isLoading: query.isLoading || (waitingForStatusIds && !statusesQuery.isError),
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    error: error?.message ?? null,
    resetToFirstPage,
  };
}
