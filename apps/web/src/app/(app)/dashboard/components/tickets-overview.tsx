'use client';

import { DashboardInfoCard, TicketStatusTag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { SectionLoadError } from '@/app/components/shared';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useTicketStatusesQuery } from '../../tickets/statuses/hooks/use-ticket-statuses-query';
import { TICKET_STATUS_KIND } from '../../tickets/utils/ticket-statistics';
import { useTicketsOverview } from '../hooks/use-dashboard-stats';

type TicketsOverviewData = ReturnType<typeof useTicketsOverview>;

interface TicketsOverviewLinks {
  /**
   * Each card opens the Tickets list narrowed to the statuses it counts (`?status=`, read by
   * both the board and the table). Off: every card opens the bare list.
   */
  filterLinks?: boolean;
}

/** The ticket counts, read. */
export function TicketsOverviewSection({ filterLinks = false }: TicketsOverviewLinks) {
  return <TicketsOverview tickets={useTicketsOverview()} filterLinks={filterLinks} />;
}

/** The four cards in order: each card's static title, the status kind it counts and the count it reads. */
const TICKET_CARDS: ReadonlyArray<{
  key: string;
  kind: string;
  title: (tickets: TicketsOverviewData | undefined) => ReactNode;
  count: (tickets: TicketsOverviewData) => number | null | undefined;
}> = [
  {
    key: 'ai',
    kind: TICKET_STATUS_KIND.AI_ASSISTANCE,
    title: () => <TicketStatusTag status="AI_ASSISTANCE" />,
    count: tickets => tickets.aiAssistance,
  },
  {
    key: 'tech',
    kind: TICKET_STATUS_KIND.TECH_REQUIRED,
    title: tickets => <TicketStatusTag status="TECH_REQUIRED" color={tickets?.techRequiredColor} />,
    count: tickets => tickets.techRequired,
  },
  {
    key: 'resolved',
    kind: TICKET_STATUS_KIND.RESOLVED,
    title: () => <TicketStatusTag status="RESOLVED" />,
    count: tickets => tickets.resolved,
  },
  {
    key: 'other',
    kind: TICKET_STATUS_KIND.CUSTOM,
    title: () => (
      <span className="flex h-8 items-center uppercase text-ods-text-secondary text-h5">Other Statuses</span>
    ),
    count: tickets => tickets.otherStatuses,
  },
];

/** The section over the counts it is handed; with none (or in a loading scope) the cards draw their figures as bars. */
export function TicketsOverview({
  tickets,
  filterLinks = false,
}: TicketsOverviewLinks & { tickets?: TicketsOverviewData }) {
  const loading = useLoadingScope() || !tickets || tickets.isLoading;
  // A card counts a status KIND (the statistics carry no ids), and the list filters by status
  // id: the tenant's statuses name the ids behind each kind. Shared cache with the Tickets page.
  const statuses = useTicketStatusesQuery({ enabled: filterLinks });

  // Until the statuses answer, a card opens the bare list rather than nothing.
  const hrefFor = (kind: string) =>
    filterLinks
      ? routes.tickets.filtered({
          status: (statuses.data?.snapshot ?? []).filter(status => status.kind === kind).map(status => status.id),
        })
      : routes.tickets.list;

  return (
    <LoadingRegion label="Loading tickets overview" announce={loading}>
      <TitleBlock title="Tickets Overview" />

      {!loading && tickets && (tickets.error || tickets.isOffline) && (
        <SectionLoadError
          {...loadErrorProps(tickets.isOffline, "Couldn't load ticket counts.", () => tickets.refetch())}
        />
      )}

      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] content-md:grid-cols-2 content-lg:grid-cols-4">
        {TICKET_CARDS.map(card => (
          <DashboardInfoCard
            key={card.key}
            loading={loading}
            titleSlot={card.title(tickets)}
            value={loading || !tickets ? '' : (card.count(tickets) ?? EMPTY_VALUE)}
            href={hrefFor(card.kind)}
          />
        ))}
      </div>
    </LoadingRegion>
  );
}
