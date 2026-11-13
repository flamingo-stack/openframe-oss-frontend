'use client';

import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouInsightsSourceQuery as NeedsYouInsightsSourceQueryType } from '@/__generated__/needsYouInsightsSourceQuery.graphql';
import { toIncidentRow } from '@/app/(app)/incidents/utils/incident-transform';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { criticalIncidentRow, diskWarningRow, NEEDS_YOU_CANDIDATES, type ReportSource } from './needs-you-rows';

/**
 * Four reads of saas-api's insights, one round-trip (one backend, so they fail together):
 *
 * - `critical`: NEW incidents of CRITICAL severity, newest first.
 * - `disk`: unresolved disk warnings (the `DISK_SPACE_LOW` detector).
 * - `newIncidents`: how many incidents are NEW, the Incidents quick action's count.
 * - `diskWarnings`: how many disk warnings are unresolved, the Devices quick action's count.
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
    disk: insights(filter: { kinds: [DISK_SPACE_LOW], statuses: [NEW, ACKNOWLEDGED] }, first: $diskFirst) {
      edges {
        node {
          ...insightRowFields_insight
        }
      }
    }
    newIncidents: insightFilters(filter: { statuses: [NEW] }) {
      filteredCount
    }
    diskWarnings: insightFilters(filter: { kinds: [DISK_SPACE_LOW], statuses: [NEW, ACKNOWLEDGED] }) {
      filteredCount
    }
  }
`;

/** Reports `incidents` (with the NEW count) and `disk` (with the unresolved count); renders nothing. */
export function NeedsYouInsightsSource({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<NeedsYouInsightsSourceQueryType>(
    needsYouInsightsSourceQuery,
    { criticalFirst: NEEDS_YOU_CANDIDATES, diskFirst: NEEDS_YOU_CANDIDATES },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Memoized for the effects below, which report only when the rows actually change.
  const criticalRows = useMemo(
    () => data.critical.edges.map(edge => criticalIncidentRow(toIncidentRow(edge.node))),
    [data.critical.edges],
  );
  const diskRows = useMemo(
    () => data.disk.edges.map(edge => diskWarningRow(toIncidentRow(edge.node))),
    [data.disk.edges],
  );
  const newIncidents = data.newIncidents.filteredCount;
  const diskWarnings = data.diskWarnings.filteredCount;

  // Before paint: a source read from the store answers in the same commit, so a return to
  // the page draws its rows, not the card's loading form, for a frame.
  useLayoutEffect(() => {
    onReport('incidents', { status: 'ready', rows: criticalRows, count: newIncidents ?? undefined });
  }, [onReport, criticalRows, newIncidents]);

  useLayoutEffect(() => {
    onReport('disk', { status: 'ready', rows: diskRows, count: diskWarnings ?? undefined });
  }, [onReport, diskRows, diskWarnings]);

  return null;
}
