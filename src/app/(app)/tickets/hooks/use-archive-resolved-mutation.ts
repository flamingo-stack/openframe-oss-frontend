'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import { ARCHIVE_RESOLVED_TICKETS_MUTATION } from '../queries/ticket-queries';
import type { TicketsPage } from '../services/ticket-service.types';
import type { Dialog, TicketActivityFilter } from '../types/dialog.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { dialogsQueryKeys, invalidateAllDialogs, ticketsQueryKeys } from '../utils/query-keys';

interface ArchiveResolvedPayload {
  archiveResolvedTickets: {
    count: number;
    userErrors: Array<{ field?: string[]; message: string }>;
  };
}

export interface ArchiveResolvedFilter {
  organizationIds?: string[];
  assigneeIds?: string[];
  tagIds?: string[];
  unreadOnly?: boolean;
  // Must mirror every filter the Resolved lane is fetched under — the confirm
  // dialog's count is the filtered lane total, so a filter dropped here would
  // archive more than the dialog stated.
  activity?: TicketActivityFilter[];
}

export function useArchiveResolvedMutation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (filter: ArchiveResolvedFilter): Promise<{ count: number }> => {
      const response = await apiClient.post<GraphQlResponse<ArchiveResolvedPayload>>(API_ENDPOINTS.GRAPHQL, {
        query: ARCHIVE_RESOLVED_TICKETS_MUTATION,
        variables: {
          filter: {
            organizationIds: filter.organizationIds?.length ? filter.organizationIds : undefined,
            assigneeIds: filter.assigneeIds?.length ? filter.assigneeIds : undefined,
            tagIds: filter.tagIds?.length ? filter.tagIds : undefined,
            hasUnreadNotifications: filter.unreadOnly || undefined,
            activity: filter.activity?.length ? filter.activity : undefined,
          },
        },
      });

      const data = extractGraphQlData(response);
      const payload = data.archiveResolvedTickets;

      if (payload.userErrors?.length) {
        throw new Error(payload.userErrors[0].message);
      }

      return { count: payload.count };
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: dialogsQueryKeys.lists() });

      const previousQueries = queryClient.getQueriesData({ queryKey: dialogsQueryKeys.lists() });

      // Every dialogs list is an infinite query over `TicketsPage`s. Typed loosely
      // on the outside because `setQueriesData` runs against every matching key,
      // including one that has not loaded a page yet.
      queryClient.setQueriesData<InfiniteData<TicketsPage> | undefined>(
        { queryKey: dialogsQueryKeys.lists() },
        oldData => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              dialogs: page.dialogs.filter((dialog: Dialog) => dialog.status !== 'RESOLVED'),
            })),
          };
        },
      );

      return { previousQueries };
    },

    onError: (error, _variables, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, previousData] of context.previousQueries) {
          queryClient.setQueryData(queryKey, previousData);
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to archive resolved tickets';
      console.error('Failed to archive resolved tickets:', error);

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    },

    onSuccess: ({ count }) => {
      toast({
        title: 'Success',
        description: `${count} ticket${count !== 1 ? 's' : ''} archived successfully`,
        variant: 'success',
        duration: 4000,
      });
    },

    onSettled: () => {
      invalidateAllDialogs(queryClient);
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.statistics() });
    },
  });
}
