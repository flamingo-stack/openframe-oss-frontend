'use client';

import { useQuery } from '@tanstack/react-query';
import { queryState } from '@/lib/query-state';
import { ticketService } from '../services';
import type { Dialog } from '../types/dialog.types';
import { ticketsQueryKeys } from '../utils/query-keys';

export function useTicketDetail(ticketId: string | null | undefined) {
  const query = useQuery<Dialog | null, Error>({
    queryKey: ticketId ? ticketsQueryKeys.detail(ticketId) : ['tickets', 'detail', '__none__'],
    queryFn: () => ticketService.fetchDialog(ticketId as string),
    enabled: !!ticketId,
    staleTime: 30_000,
  });

  const state = queryState(query, ticketId ? 'open' : 'closed');

  return {
    ticket: query.data ?? null,
    // `state.isLoading` excludes paused, which the view's old `isPending` gate did
    // not — a PAUSED query left the whole ticket route as a permanent skeleton
    // with only a Back button. `isOffline` is what the view renders instead.
    ...state,
    refetch: query.refetch,
  };
}
