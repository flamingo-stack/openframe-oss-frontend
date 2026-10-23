'use client';

import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouTenantsSourceQuery as NeedsYouTenantsSourceQueryType } from '@/__generated__/needsYouTenantsSourceQuery.graphql';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { failedSyncTenantRow, type ReportSource } from './needs-you-rows';

/** How many failed connections are read: the card's cap, plus room for rows it drops as duplicates. */
const TENANT_CANDIDATES = 5;

/**
 * Cloud tenants whose last sync failed, filtered by the server (`lastSyncStatuses`), so a
 * tenant past the list's first page is seen too. No `access` — that is a provider probe
 * per row, which only the list pays for.
 */
const needsYouTenantsSourceQuery = graphql`
  query needsYouTenantsSourceQuery($first: Int!) {
    directoryConnections(filter: { lastSyncStatuses: [ERROR] }, first: $first) {
      edges {
        node {
          id
          name
          provider
          organization {
            name
          }
        }
      }
    }
  }
`;

/** Reports `tenants`; renders nothing. */
export function NeedsYouTenantsSource({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<NeedsYouTenantsSourceQueryType>(
    needsYouTenantsSourceQuery,
    { first: TENANT_CANDIDATES },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Memoized for the effect below, which reports only when the rows actually change.
  const rows = useMemo(
    () =>
      data.directoryConnections.edges.map(({ node }) =>
        failedSyncTenantRow({
          id: node.id,
          name: node.name,
          provider: node.provider,
          customerName: node.organization.name,
        }),
      ),
    [data.directoryConnections.edges],
  );

  useEffect(() => {
    onReport('tenants', { status: 'ready', rows });
  }, [onReport, rows]);

  return null;
}
