/**
 * A decision made anywhere is recorded once (the mutation records it), and a decision made
 * on the Needs approval page reaches the caches the board and the chat list draw from.
 */

import { type InfiniteData, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteMingoDialogResponse, useMingoDialogRowsStore } from '@/app/(app)/mingo/stores/mingo-dialog-rows-store';
import type { TicketsPage } from '@/app/(app)/tickets/services/ticket-service.types';
import { dialogsQueryKeys, ticketsQueryKeys } from '@/app/(app)/tickets/utils/query-keys';
import {
  clearApprovalDecisions,
  noteApprovalDecision,
  settleApprovalCaches,
  useApprovalDecisionsStore,
} from './approval-decisions';

afterEach(() => {
  clearApprovalDecisions();
  useMingoDialogRowsStore.setState({ rows: new Map(), missing: new Set(), restored: new Set() });
});

describe('noteApprovalDecision', () => {
  it('records the outcome and keeps the state when nothing changed', () => {
    noteApprovalDecision('ar-1', true);
    noteApprovalDecision('ar-2', false);
    const state = useApprovalDecisionsStore.getState();
    expect(state.decisions).toEqual({ 'ar-1': 'approved', 'ar-2': 'rejected' });

    noteApprovalDecision('ar-1', true);
    expect(useApprovalDecisionsStore.getState()).toBe(state);
  });
});

describe('settleApprovalCaches', () => {
  const lanePage = (approvalId: string | null): InfiniteData<TicketsPage> => ({
    pageParams: [undefined],
    pages: [
      {
        dialogs: [
          { id: 't-1', pendingApproval: approvalId ? { id: approvalId } : undefined },
          { id: 't-2', pendingApproval: { id: 'ar-other' } },
        ] as TicketsPage['dialogs'],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        filteredCount: 2,
      },
    ],
  });
  const listChats = () =>
    noteMingoDialogResponse({
      dialogs: {
        edges: [
          { node: { id: 'g-1', dialogId: 'd-1', createdAt: '2026-10-09T09:00:00Z', pendingApproval: { id: 'ar-1' } } },
          { node: { id: 'g-2', dialogId: 'd-2', createdAt: '2026-10-09T09:00:00Z', pendingApproval: null } },
        ],
      },
    });

  it('takes the request off the board lane and the chat list, and refreshes its ticket', () => {
    const queryClient = new QueryClient();
    const laneKey = dialogsQueryKeys.boardColumn('s-tech', {});
    queryClient.setQueryData(laneKey, lanePage('ar-1'));
    listChats();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    settleApprovalCaches(queryClient, 'ar-1');

    const lane = queryClient.getQueryData<InfiniteData<TicketsPage>>(laneKey);
    expect(lane?.pages[0].dialogs.map(ticket => ticket.pendingApproval?.id)).toEqual([undefined, 'ar-other']);
    const { rows } = useMingoDialogRowsStore.getState();
    expect([rows.get('d-1')?.awaitingApproval, rows.get('d-2')?.awaitingApproval]).toEqual([false, false]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ticketsQueryKeys.detail('t-1') });
  });

  it('leaves a cache that does not hold the request untouched', () => {
    const queryClient = new QueryClient();
    const laneKey = dialogsQueryKeys.boardColumn('s-tech', {});
    const before = lanePage(null);
    queryClient.setQueryData(laneKey, before);

    settleApprovalCaches(queryClient, 'ar-1');

    expect(queryClient.getQueryData(laneKey)).toBe(before);
  });
});
