'use client';

import { DashboardInfoCard, TicketStatusTag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { SectionLoadError } from '@/app/components/shared';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useTicketStatusesQuery } from '../../tickets/statuses/hooks/use-ticket-statuses-query';
import { TICKET_STATUS_KIND } from '../../tickets/utils/ticket-statistics';
import { useTicketsOverview } from '../hooks/use-dashboard-stats';
import { TicketsOverviewSkeleton } from './dashboard-skeletons';

interface TicketsOverviewSectionProps {
  /**
   * Each card opens the Tickets list narrowed to the statuses it counts (`?status=`, read by
   * both the board and the table). Off: every card opens the bare list.
   */
  filterLinks?: boolean;
}

export function TicketsOverviewSection({ filterLinks = false }: TicketsOverviewSectionProps) {
  const tickets = useTicketsOverview();
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

  if (tickets.isLoading) {
    return <TicketsOverviewSkeleton />;
  }

  return (
    <div>
      <TitleBlock title="Tickets Overview" />

      {(tickets.error || tickets.isOffline) && (
        <SectionLoadError
          {...loadErrorProps(tickets.isOffline, "Couldn't load ticket counts.", () => tickets.refetch())}
        />
      )}

      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] content-md:grid-cols-2 content-lg:grid-cols-4">
        <DashboardInfoCard
          titleSlot={<TicketStatusTag status="AI_ASSISTANCE" />}
          value={tickets.aiAssistance ?? EMPTY_VALUE}
          href={hrefFor(TICKET_STATUS_KIND.AI_ASSISTANCE)}
        />
        <DashboardInfoCard
          titleSlot={<TicketStatusTag status="TECH_REQUIRED" color={tickets.techRequiredColor} />}
          value={tickets.techRequired ?? EMPTY_VALUE}
          href={hrefFor(TICKET_STATUS_KIND.TECH_REQUIRED)}
        />
        <DashboardInfoCard
          titleSlot={<TicketStatusTag status="RESOLVED" />}
          value={tickets.resolved ?? EMPTY_VALUE}
          href={hrefFor(TICKET_STATUS_KIND.RESOLVED)}
        />
        <DashboardInfoCard
          titleSlot={
            <span className="flex h-8 items-center uppercase text-ods-text-secondary text-h5">Other Statuses</span>
          }
          value={tickets.otherStatuses ?? EMPTY_VALUE}
          href={hrefFor(TICKET_STATUS_KIND.CUSTOM)}
        />
      </div>
    </div>
  );
}

export default TicketsOverviewSection;
