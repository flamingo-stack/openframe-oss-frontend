'use client';

import { DashboardInfoCard, TicketStatusTag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SectionLoadError } from '@/app/components/shared';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useTicketsOverview } from '../hooks/use-dashboard-stats';

type TicketsOverviewData = ReturnType<typeof useTicketsOverview>;

/** The section while the counts load: the real header and four cards with their real status tags. */
export function TicketsOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading tickets overview">
      <TitleBlock title="Tickets Overview" />
      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] content-md:grid-cols-2 content-lg:grid-cols-4">
        <DashboardInfoCard loading value="" titleSlot={<TicketStatusTag status="AI_ASSISTANCE" />} />
        <DashboardInfoCard
          loading
          value=""
          titleSlot={
            <TicketStatusTag
              status="TECH_REQUIRED"
              className="bg-ods-warning text-ods-text-on-accent hover:bg-ods-warning"
            />
          }
        />
        <DashboardInfoCard loading value="" titleSlot={<TicketStatusTag status="RESOLVED" />} />
        <DashboardInfoCard
          loading
          value=""
          titleSlot={
            <span className="flex h-8 items-center uppercase text-ods-text-secondary text-h5">Other Statuses</span>
          }
        />
      </div>
    </LoadingRegion>
  );
}

/** The ticket counts, read. */
export function TicketsOverviewSection() {
  return <TicketsOverview tickets={useTicketsOverview()} />;
}

/** The section over the counts it is handed; with none (or in a loading scope) it draws its own skeleton. */
export function TicketsOverview({ tickets }: { tickets?: TicketsOverviewData }) {
  const loading = useLoadingScope() || !tickets || tickets.isLoading;
  if (loading) return <TicketsOverviewSkeleton />;

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
          href={routes.tickets.list}
        />
        <DashboardInfoCard
          titleSlot={<TicketStatusTag status="TECH_REQUIRED" color={tickets.techRequiredColor} />}
          value={tickets.techRequired ?? EMPTY_VALUE}
          href={routes.tickets.list}
        />
        <DashboardInfoCard
          titleSlot={<TicketStatusTag status="RESOLVED" />}
          value={tickets.resolved ?? EMPTY_VALUE}
          href={routes.tickets.list}
        />
        <DashboardInfoCard
          titleSlot={
            <span className="flex h-8 items-center uppercase text-ods-text-secondary text-h5">Other Statuses</span>
          }
          value={tickets.otherStatuses ?? EMPTY_VALUE}
          href={routes.tickets.list}
        />
      </div>
    </div>
  );
}

export default TicketsOverviewSection;
