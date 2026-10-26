'use client';

import { DashboardInfoCard, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion, LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Chevron02RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { mingoHomeIncidentsQuery as MingoHomeIncidentsQueryType } from '@/__generated__/mingoHomeIncidentsQuery.graphql';
import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared/content-error-boundary';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { InsightSeverity, InsightStatus } from '@/generated/schema-enums';
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
 * A card opens the Current tab narrowed to its severity AND to those statuses
 * (`UNRESOLVED`, which must match the query's literal): the tab alone also lists the
 * RESOLVED incidents waiting to be archived, which the count leaves out.
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

/** The statuses the counts cover, and the list a card opens narrows to. */
const UNRESOLVED = [InsightStatus.NEW, InsightStatus.ACKNOWLEDGED];

/** The incidents a card counts: its severity, unresolved. */
const severityHref = (severity: InsightSeverity) =>
  routes.incidents.filtered({ severity: [severity], status: UNRESOLVED });

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
  // The page's loading state draws the section's own, as the unanswered gate does.
  const loading = useLoadingScope() || gate === 'loading';

  if (gate === 'off') return null;
  if (loading) return <IncidentsSkeleton />;

  return (
    <ContentErrorBoundary
      label="MingoHomeIncidents"
      fallback={(retry, { isOffline }) => <IncidentsFailed isOffline={isOffline} retry={retry} />}
    >
      <IncidentsSection />
    </ContentErrorBoundary>
  );
}

function IncidentsSection() {
  return (
    <LoadingSuspense label="Loading incidents">
      <IncidentsReader />
    </LoadingSuspense>
  );
}

/** In its boundary's loading scope it draws the section's loading state and runs no read. */
function IncidentsReader() {
  if (useLoadingScope()) return <IncidentsSkeleton />;
  return <IncidentsCards />;
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
            href={severityHref(severity)}
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
            href={severityHref(severity)}
          />
        ))}
      </div>
    </div>
  );
}
