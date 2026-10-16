'use client';

import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouInsightsSourceQuery as NeedsYouInsightsSourceQueryType } from '@/__generated__/needsYouInsightsSourceQuery.graphql';
import { toIncidentRow } from '@/app/(app)/incidents/utils/incident-transform';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { InsightKind } from '@/generated/schema-enums';
import { criticalIncidentRow, diskWarningRow, NEEDS_YOU_CAPS, type ReportSource } from './needs-you-rows';

/** How many unresolved IT findings are read to find a disk warning — see the query. */
const DISK_CANDIDATES = 20;

/**
 * Three reads of saas-api's insights, one round-trip (one backend, so they fail together):
 *
 * - `critical`: NEW incidents of CRITICAL severity, newest first.
 * - `disk`: devices with a disk warning. `InsightFilter` has no `kinds`, so this narrows
 *   to unresolved IT findings sorted by kind — by its stored name, so DISK_SPACE_LOW
 *   follows only the few IT kinds that sort before it (BATTERY_WORN) — and keeps the
 *   DISK_SPACE_LOW ones of the first page.
 * - `newIncidents`: how many incidents are NEW, for the card's footer.
 */
const needsYouInsightsSourceQuery = graphql`
  query needsYouInsightsSourceQuery($criticalFirst: Int!, $diskFirst: Int!) {
    critical: insights(filter: { severities: [CRITICAL], statuses: [NEW] }, first: $criticalFirst) {
      edges {
        node {
          ...insightRowFields_insight
        }
      }
    }
    disk: insights(
      filter: { types: [IT], statuses: [NEW, ACKNOWLEDGED] }
      sort: { field: KIND, direction: ASC }
      first: $diskFirst
    ) {
      edges {
        node {
          kind
          ...insightRowFields_insight
        }
      }
    }
    newIncidents: insightFilters(filter: { statuses: [NEW] }) {
      filteredCount
    }
  }
`;

/** Reports `incidents` (with the NEW count for the footer) and `disk`; renders nothing. */
export function NeedsYouInsightsSource({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<NeedsYouInsightsSourceQueryType>(
    needsYouInsightsSourceQuery,
    { criticalFirst: NEEDS_YOU_CAPS.incidents, diskFirst: DISK_CANDIDATES },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Memoized for the effects below, which report only when the rows actually change.
  const criticalRows = useMemo(
    () => data.critical.edges.map(edge => criticalIncidentRow(toIncidentRow(edge.node))),
    [data.critical.edges],
  );
  const diskRows = useMemo(
    () =>
      data.disk.edges
        .filter(edge => edge.node.kind === InsightKind.DISK_SPACE_LOW)
        .map(edge => diskWarningRow(toIncidentRow(edge.node))),
    [data.disk.edges],
  );
  const newIncidents = data.newIncidents.filteredCount;

  useEffect(() => {
    onReport('incidents', { status: 'ready', rows: criticalRows, count: newIncidents ?? undefined });
  }, [onReport, criticalRows, newIncidents]);

  useEffect(() => {
    onReport('disk', { status: 'ready', rows: diskRows });
  }, [onReport, diskRows]);

  return null;
}
