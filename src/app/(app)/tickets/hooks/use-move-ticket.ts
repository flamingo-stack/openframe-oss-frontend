'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ticketService } from '../services';
import {
  applyOptimisticMove,
  invalidateBoardColumns,
  type OptimisticMoveInput,
  type OptimisticMoveSnapshot,
  rollbackOptimisticMove,
} from '../utils/optimistic-board';
import { dialogsQueryKeys, ticketsQueryKeys } from '../utils/query-keys';

export interface MoveTicketParams {
  ticketId: string;
  sourceStatusId: string;
  targetStatusId: string;
  afterTicketId: string | null;
  beforeTicketId: string | null;
}

const MOVE_TICKET_MUTATION_KEY = ['tickets-board', 'move'] as const;

/**
 * Sends ONE anchor, never both: given two, the backend ranks strictly between their
 * two ranks, which throws when the neighbours share a rank. Given one, it resolves
 * the opposite neighbour itself by a strict comparison that steps over ties.
 */
async function moveTicketRequest(params: MoveTicketParams): Promise<void> {
  const isCrossColumn = params.sourceStatusId !== params.targetStatusId;
  const hasAnchor = params.afterTicketId !== null || params.beforeTicketId !== null;

  if (isCrossColumn && !hasAnchor) {
    await ticketService.transitionTicket(params.ticketId, params.targetStatusId);
    return;
  }

  await ticketService.reorderTicket({
    id: params.ticketId,
    afterTicketId: params.afterTicketId,
    beforeTicketId: params.afterTicketId !== null ? null : params.beforeTicketId,
    // Always sent, same-column reorder included: its presence is what selects the
    // lifecycle ranking. Without it the backend ranks against the legacy `status`
    // enum, which is unset on migrated tickets — every lane collapses into one
    // pseudo-column there and the rank it writes means nothing for the real one.
    statusId: params.targetStatusId,
  });
}

export function useMoveTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<void, Error, MoveTicketParams, OptimisticMoveSnapshot>({
    mutationKey: MOVE_TICKET_MUTATION_KEY,
    scope: { id: 'tickets-board-move' },
    mutationFn: moveTicketRequest,
    onMutate: async params => {
      await queryClient.cancelQueries({ queryKey: dialogsQueryKeys.boardColumns() });
      const input: OptimisticMoveInput = {
        ticketId: params.ticketId,
        sourceStatusId: params.sourceStatusId,
        targetStatusId: params.targetStatusId,
        afterTicketId: params.afterTicketId,
        beforeTicketId: params.beforeTicketId,
      };
      return applyOptimisticMove(queryClient, input);
    },
    onError: (err, _params, snapshot) => {
      // Reverts immediately so the card cannot hang at the drop position; onSettled
      // then re-reads the truth, because this rollback is only a guess (see below).
      if (snapshot) rollbackOptimisticMove(queryClient, snapshot);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to move ticket',
        variant: 'destructive',
        duration: 5000,
      });
    },
    // Re-reads both lanes however the move ended: the optimistic state is a guess
    // either way. A failed `reorderTicket` is not all-or-nothing — it commits the
    // status transition before ranking, so an error can leave the ticket already
    // moved — and a successful one can be overwritten mid-flight by another
    // invalidation (the take-over flow refetches every lane, then reorders).
    onSettled: (_data, _err, params) => {
      invalidateBoardColumns(queryClient, [params.sourceStatusId, params.targetStatusId]);
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.detail(params.ticketId) });
      if (params.sourceStatusId !== params.targetStatusId) {
        queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.statistics() });
      }
    },
  });
}

export function useMovingTicketIds(): Set<string> {
  const pending = useMutationState<string>({
    filters: { mutationKey: MOVE_TICKET_MUTATION_KEY, status: 'pending' },
    select: m => (m.state.variables as MoveTicketParams | undefined)?.ticketId ?? '',
  });
  return useMemo(() => new Set(pending.filter(Boolean)), [pending]);
}
