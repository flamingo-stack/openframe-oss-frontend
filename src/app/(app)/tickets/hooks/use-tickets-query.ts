'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { queryState } from '@/lib/query-state';
import { ticketService } from '../services';
import type { TicketsPage } from '../services/ticket-service.types';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import { isGraphQlValidationError } from '../utils/graphql';
import { type DialogsQueryParams, dialogsQueryKeys } from '../utils/query-keys';

const TICKETS_PAGE_SIZE = 20;
// Legacy non-archived status set — the default filter when no lifecycle statusIds are available.
const NON_ARCHIVED_STATUSES = ['ACTIVE', 'TECH_REQUIRED', 'ON_HOLD', 'RESOLVED'];

export function useTicketsQuery({
  archived,
  search,
  statusFilters,
  organizationIds,
  assigneeIds,
  tagIds,
  pageSize = TICKETS_PAGE_SIZE,
}: DialogsQueryParams) {
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

  const waitingForStatusIds = statusesQuery.isLoading;

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
      // `statuses` is the enum fallback; fetchDialogs prefers `statusIds` whenever it's non-empty.
      // It's only used when the snapshot can't resolve ids (e.g. its fetch errored),
      // keeping the non-archived list scoped instead of sending an empty filter that leaks archived.
      let statuses: string[] = [];
      if (archived) {
        statuses = ['ARCHIVED'];
      } else if (!statusIds?.length) {
        statuses = NON_ARCHIVED_STATUSES;
      }

      return ticketService.fetchDialogs({
        statuses,
        statusIds,
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
    // A schema-validation failure is deterministic — retrying it only delays the
    // error. Transient failures still get the two attempts.
    retry: (count, error) => !isGraphQlValidationError(error) && count < 2,
    retryDelay: 1000,
  });

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

  // Only a first-load failure with no rows is an error state; a background
  // refetch that fails behind cached rows keeps the stale rows on screen.
  const state = queryState(query);

  return {
    dialogs,
    isLoading: query.isLoading || waitingForStatusIds,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isError: state.error !== null,
    isOffline: state.isOffline,
    refetch: query.refetch,
    resetToFirstPage,
  };
}
