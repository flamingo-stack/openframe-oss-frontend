'use client';

import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouInsightsSourceQuery as NeedsYouInsightsSourceQueryType } from '@/__generated__/needsYouInsightsSourceQuery.graphql';
import { toIncidentRow } from '@/app/(app)/incidents/utils/incident-transform';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { criticalIncidentRow, NEEDS_YOU_CANDIDATES, type ReportSource } from './needs-you-rows';

/**
 * Two reads of saas-api's insights, one round-trip:
 *
 * - `critical`: NEW incidents of CRITICAL severity, newest first.
 * - `criticalCount`: how many there are, the Incidents quick action's count.
 */
const needsYouInsightsSourceQuery = graphql`
  query needsYouInsightsSourceQuery($criticalFirst: Int!) {
    critical: insights(filter: { severities: [CRITICAL], statuses: [NEW] }, first: $criticalFirst) {
      edges {
        node {
          ...insightRowFields_insight
        }
      }
    }
    criticalCount: insightFilters(filter: { severities: [CRITICAL], statuses: [NEW] }) {
      filteredCount
    }
  }
`;

/** Reports `incidents` (with the count of NEW critical incidents); renders nothing. */
export function NeedsYouInsightsSource({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<NeedsYouInsightsSourceQueryType>(
    needsYouInsightsSourceQuery,
    { criticalFirst: NEEDS_YOU_CANDIDATES },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Memoized for the effect below, which reports only when the rows actually change.
  const criticalRows = useMemo(
    () => data.critical.edges.map(edge => criticalIncidentRow(toIncidentRow(edge.node))),
    [data.critical.edges],
  );
  const criticalCount = data.criticalCount.filteredCount;

  // Before paint: a source read from the store answers in the same commit, so a return to
  // the page draws its rows, not the card's loading form, for a frame.
  useLayoutEffect(() => {
    onReport('incidents', { status: 'ready', rows: criticalRows, count: criticalCount ?? undefined });
  }, [onReport, criticalRows, criticalCount]);

  return null;
}
