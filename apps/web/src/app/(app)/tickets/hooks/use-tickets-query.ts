'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { ticketService } from '../services';
import type { TicketsPage } from '../services/ticket-service.types';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import { type DialogsQueryParams, dialogsQueryKeys } from '../utils/query-keys';

/** One page of a ticket list; a ticket table's loading state draws this many rows. */
export const TICKETS_PAGE_SIZE = 20;

/** The list a key belongs to: what it is scoped to, apart from search, filters and sort. */
function scopeOf(params: unknown): string {
  const { archived, deviceIds, organizationIds } = (params ?? {}) as DialogsQueryParams;
  return JSON.stringify([Boolean(archived), deviceIds ?? [], organizationIds ?? []]);
}

export function useTicketsQuery({
  archived,
  search,
  statusFilters,
  organizationIds,
  deviceIds,
  assigneeIds,
  tagIds,
  unreadOnly,
  sort,
  pageSize = TICKETS_PAGE_SIZE,
  enabled = true,
}: DialogsQueryParams & {
  /** `false` holds the request — a scoped list must not fall back to the whole tenant while its scope id is unknown. */
  enabled?: boolean;
}) {
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
      deviceIds,
      assigneeIds,
      tagIds,
      unreadOnly,
      sort,
      pageSize,
    }),
    enabled: enabled && !waitingForStatusIds,
    queryFn: async ({ pageParam }) => {
      return ticketService.fetchDialogs({
        statusIds: statusIds ?? [],
        search: search || undefined,
        organizationIds: organizationIds?.length ? organizationIds : undefined,
        deviceIds: deviceIds?.length ? deviceIds : undefined,
        assigneeIds: assigneeIds?.length ? assigneeIds : undefined,
        tagIds: tagIds?.length ? tagIds : undefined,
        unreadOnly: unreadOnly || undefined,
        sort: sort ?? undefined,
        cursor: pageParam as string | undefined,
        limit: pageSize,
      });
    },
    getNextPageParam: lastPage => (lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined),
    initialPageParam: undefined as string | undefined,
    // A new search, filter or sort keeps the rows on screen, dimmed (`isPending`), until it answers: only the first page
    // ever draws the loading state. A different scope (another device or organization, the archive) is another list,
    // so it never shows the previous one's tickets.
    placeholderData: (previous, previousQuery) =>
      previousQuery && scopeOf(previousQuery.queryKey.at(-1)) === scopeOf({ archived, deviceIds, organizationIds })
        ? keepPreviousData(previous)
        : undefined,
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
  // The server's count of everything the filter matches, not what has been paged in so far.
  const filteredCount = query.data?.pages[0]?.filteredCount ?? 0;

  const resetToFirstPage = useCallback(() => {
    queryClient.resetQueries({
      queryKey: dialogsQueryKeys.list({
        archived,
        search,
        statusFilters,
        statusIds,
        organizationIds,
        deviceIds,
        assigneeIds,
        tagIds,
        unreadOnly,
        sort,
        pageSize,
      }),
    });
  }, [
    queryClient,
    archived,
    search,
    statusFilters,
    statusIds,
    organizationIds,
    deviceIds,
    assigneeIds,
    tagIds,
    unreadOnly,
    sort,
    pageSize,
  ]);

  return {
    dialogs,
    filteredCount,
    /** The first page has not answered: the list draws its loading state. */
    isLoading: query.isLoading || (waitingForStatusIds && !statusesQuery.isError),
    /** A new key is being read and the rows on screen are the previous key's: the list dims them. */
    isPending: query.isPlaceholderData && query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    error: error?.message ?? null,
    resetToFirstPage,
  };
}
