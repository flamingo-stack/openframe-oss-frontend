'use client';

import { DashboardInfoCard, TicketStatusTag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { SectionLoadError } from '@/app/components/shared';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useTicketsOverview } from '../hooks/use-dashboard-stats';

type TicketsOverviewData = ReturnType<typeof useTicketsOverview>;

/** The ticket counts, read. */
export function TicketsOverviewSection() {
  return <TicketsOverview tickets={useTicketsOverview()} />;
}

/** The four cards in order: each card's static title and the count it reads. */
const TICKET_CARDS: ReadonlyArray<{
  key: string;
  title: (tickets: TicketsOverviewData | undefined) => ReactNode;
  count: (tickets: TicketsOverviewData) => number | null | undefined;
}> = [
  { key: 'ai', title: () => <TicketStatusTag status="AI_ASSISTANCE" />, count: tickets => tickets.aiAssistance },
  {
    key: 'tech',
    title: tickets => <TicketStatusTag status="TECH_REQUIRED" color={tickets?.techRequiredColor} />,
    count: tickets => tickets.techRequired,
  },
  { key: 'resolved', title: () => <TicketStatusTag status="RESOLVED" />, count: tickets => tickets.resolved },
  {
    key: 'other',
    title: () => (
      <span className="flex h-8 items-center uppercase text-ods-text-secondary text-h5">Other Statuses</span>
    ),
    count: tickets => tickets.otherStatuses,
  },
];

/** The section over the counts it is handed; with none (or in a loading scope) the cards draw their figures as bars. */
export function TicketsOverview({ tickets }: { tickets?: TicketsOverviewData }) {
  const loading = useLoadingScope() || !tickets || tickets.isLoading;

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
            href={routes.tickets.list}
          />
        ))}
      </div>
    </LoadingRegion>
  );
}

export default TicketsOverviewSection;
