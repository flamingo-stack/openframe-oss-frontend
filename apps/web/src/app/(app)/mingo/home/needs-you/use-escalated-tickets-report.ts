'use client';

import { useQuery } from '@tanstack/react-query';
import { ticketService } from '@/app/(app)/tickets/services';
import { useTicketStatusesQuery } from '@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query';
import { dialogsQueryKeys } from '@/app/(app)/tickets/utils/query-keys';
import { TICKET_STATUS_KIND } from '@/app/(app)/tickets/utils/ticket-statistics';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { queryState } from '@/lib/query-state';
import { escalatedTicketRow, type SourceReport } from './needs-you-rows';

const NO_IDS: readonly string[] = [];

/** How many escalated tickets are read: the card's cap, plus room for rows it drops as duplicates. */
const ESCALATED_CANDIDATES = 5;

/**
 * The "Needs you" tickets source: Tech Required tickets the end user escalated, filtered
 * by the ai-agent (`escalatedByUser`), so one far down a long lane is seen too.
 *
 * Keyed under `dialogs`, so every ticket mutation that refreshes the board refreshes this.
 * Not the board's own key: that one caches an infinite query of a different shape.
 */
export function useEscalatedTicketsReport(gate: FeatureFlagGate): SourceReport {
  const enabled = gate === 'on';
  const statuses = useTicketStatusesQuery({ enabled });
  const statusIds = statuses.data
    ? statuses.data.snapshot.filter(status => status.kind === TICKET_STATUS_KIND.TECH_REQUIRED).map(status => status.id)
    : NO_IDS;

  const tickets = useQuery({
    queryKey: [...dialogsQueryKeys.all, 'needsYouEscalated', statusIds] as const,
    // No Tech Required lane, nothing to read: an empty `statusIds` would not narrow at all.
    queryFn: () =>
      statusIds.length === 0
        ? Promise.resolve([])
        : ticketService.fetchEscalatedTickets({ statusIds, limit: ESCALATED_CANDIDATES }),
    enabled: enabled && statuses.data !== undefined,
    staleTime: 60_000,
  });

  const statusesState = queryState(statuses, enabled ? 'open' : 'closed');
  const ticketsState = queryState(tickets, enabled ? 'open' : 'closed');

  const failure = statusesState.error || statusesState.isOffline ? statusesState : ticketsState;
  if (failure.error || failure.isOffline) {
    return {
      status: 'error',
      isOffline: failure.isOffline,
      retry: () => {
        if (statuses.isError) void statuses.refetch();
        else void tickets.refetch();
      },
    };
  }
  if (!tickets.data) return { status: 'loading' };
  return { status: 'ready', rows: tickets.data.map(escalatedTicketRow) };
}
