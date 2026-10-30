/**
 * A decision made anywhere is recorded once (the mutation records it), and a decision made
 * on the Needs approval page reaches the caches the board and the chat list draw from.
 */

import { type InfiniteData, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MingoDialogsPage } from '@/app/(app)/mingo/utils/dialog-row-status';
import { mingoDialogQueryKeys } from '@/app/(app)/mingo/utils/query-keys';
import type { TicketsPage } from '@/app/(app)/tickets/services/ticket-service.types';
import { dialogsQueryKeys, ticketsQueryKeys } from '@/app/(app)/tickets/utils/query-keys';
import {
  clearApprovalDecisions,
  noteApprovalDecision,
  settleApprovalCaches,
  useApprovalDecisionsStore,
} from './approval-decisions';

afterEach(() => clearApprovalDecisions());

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
  const chatList: InfiniteData<MingoDialogsPage> = {
    pageParams: [undefined],
    pages: [
      {
        dialogs: [
          { dialogId: 'd-1', pendingApproval: { id: 'ar-1' } },
          { dialogId: 'd-2', pendingApproval: null },
        ] as MingoDialogsPage['dialogs'],
        pageInfo: { hasNextPage: false },
      },
    ],
  };

  it('takes the request off the board lane and the chat list, and refreshes its ticket', () => {
    const queryClient = new QueryClient();
    const laneKey = dialogsQueryKeys.boardColumn('s-tech', {});
    const listKey = mingoDialogQueryKeys.list({ limit: 20, scope: 'all' });
    queryClient.setQueryData(laneKey, lanePage('ar-1'));
    queryClient.setQueryData(listKey, chatList);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    settleApprovalCaches(queryClient, 'ar-1');

    const lane = queryClient.getQueryData<InfiniteData<TicketsPage>>(laneKey);
    expect(lane?.pages[0].dialogs.map(ticket => ticket.pendingApproval?.id)).toEqual([undefined, 'ar-other']);
    const list = queryClient.getQueryData<InfiniteData<MingoDialogsPage>>(listKey);
    expect(list?.pages[0].dialogs.map(dialog => dialog.pendingApproval)).toEqual([null, null]);
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
