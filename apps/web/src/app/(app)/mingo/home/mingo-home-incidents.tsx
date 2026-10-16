'use client';

import { DashboardInfoCard, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { Chevron02RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { mingoHomeIncidentsQuery as MingoHomeIncidentsQueryType } from '@/__generated__/mingoHomeIncidentsQuery.graphql';
import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared/content-error-boundary';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { InsightSeverity } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatCount } from '@/lib/format-number';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';

/**
 * The unresolved incidents by severity: one facet query, counted under NEW + ACKNOWLEDGED
 * (the backend leaves a facet's own field out of its narrowing, so `severities` counts per
 * severity within those statuses and `filteredCount` is their total). Snoozed, resolved
 * and archived incidents wait on nobody, so none of them counts.
 *
 * A card opens the Current tab narrowed to its severity, which also lists the RESOLVED
 * ones waiting to be archived: `routes.incidents.filtered` takes no `status` yet, though
 * the page reads `?status=`.
 */
const mingoHomeIncidentsQuery = graphql`
  query mingoHomeIncidentsQuery {
    insightFilters(filter: { statuses: [NEW, ACKNOWLEDGED] }) {
      severities {
        value
        count
      }
      filteredCount
    }
  }
`;

/** The four cards, most severe first. INFO findings count in the total only. */
const SEVERITIES = [InsightSeverity.CRITICAL, InsightSeverity.HIGH, InsightSeverity.MEDIUM, InsightSeverity.LOW];

const TITLE = 'Incidents';

// With an icon: a single header action collapses to its icon below `content-md`.
const LIST_ACTION: PageActionButton[] = [
  {
    label: 'Incidents',
    ariaLabel: 'Open Incidents',
    href: routes.incidents.list,
    variant: 'outline',
    icon: <Chevron02RightIcon className="h-5 w-5 text-ods-text-secondary" />,
  },
];

const CARD_GRID = 'grid grid-cols-2 gap-[var(--spacing-system-mf)] content-lg:grid-cols-4';

/**
 * Mingo's home: "Incidents · {n} current" and a card per severity, each opening the
 * Incidents list filtered to it. SaaS with `insights` only, like the sidebar entry; while
 * that is unanswered the section shows its loading state.
 */
export function MingoHomeIncidents() {
  const gate = useIncidentsGate();

  if (gate === 'off') return null;
  if (gate === 'loading') return <IncidentsSkeleton />;

  return (
    <ContentErrorBoundary
      label="MingoHomeIncidents"
      fallback={(retry, { isOffline }) => <IncidentsFailed isOffline={isOffline} retry={retry} />}
    >
      <Suspense fallback={<IncidentsSkeleton />}>
        <IncidentsCards />
      </Suspense>
    </ContentErrorBoundary>
  );
}

function IncidentsCards() {
  const retryKey = useRetryKey();
  const { insightFilters } = useLazyLoadQuery<MingoHomeIncidentsQueryType>(
    mingoHomeIncidentsQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // A severity the facet does not list has no unresolved incident: the facet answered.
  const countOf = (severity: InsightSeverity) =>
    insightFilters.severities.find(option => option.value === severity)?.count ?? 0;

  return (
    <div>
      <TitleBlock
        title={
          insightFilters.filteredCount == null
            ? TITLE
            : `${TITLE} · ${formatCount(insightFilters.filteredCount)} current`
        }
        actions={LIST_ACTION}
      />
      <div className={CARD_GRID}>
        {SEVERITIES.map(severity => (
          <DashboardInfoCard
            key={severity}
            titleSlot={<IncidentSeverityTag severity={severity} />}
            value={countOf(severity)}
            href={routes.incidents.filtered({ severity: [severity] })}
          />
        ))}
      </div>
    </div>
  );
}

/** The real header and severity tags; only the counts are bars. */
function IncidentsSkeleton() {
  return (
    <LoadingRegion label="Loading incidents">
      <TitleBlock title={TITLE} loading actions={LIST_ACTION} />
      <div className={CARD_GRID}>
        {SEVERITIES.map(severity => (
          <DashboardInfoCard key={severity} loading value="" titleSlot={<IncidentSeverityTag severity={severity} />} />
        ))}
      </div>
    </LoadingRegion>
  );
}

/** The cards stay, with `—` instead of a count: any digit would be invented. */
function IncidentsFailed({ isOffline, retry }: { isOffline: boolean; retry: () => void }) {
  return (
    <div>
      <TitleBlock title={TITLE} actions={LIST_ACTION} />
      <SectionLoadError {...loadErrorProps(isOffline, "Couldn't load incident counts.", retry)} />
      <div className={CARD_GRID}>
        {SEVERITIES.map(severity => (
          <DashboardInfoCard
            key={severity}
            titleSlot={<IncidentSeverityTag severity={severity} />}
            value={EMPTY_VALUE}
            href={routes.incidents.filtered({ severity: [severity] })}
          />
        ))}
      </div>
    </div>
  );
}
