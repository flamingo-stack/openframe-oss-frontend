'use client';

import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouTenantsSourceQuery as NeedsYouTenantsSourceQueryType } from '@/__generated__/needsYouTenantsSourceQuery.graphql';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { DirectorySyncStatus } from '@/generated/schema-enums';
import { failedSyncTenantRow, type ReportSource } from './needs-you-rows';

/** How many connections are read to find a failed sync — see the query. */
const TENANT_CANDIDATES = 50;

/**
 * Cloud tenants whose last sync failed. `directoryConnections` takes no status filter, so
 * this reads the first page (ordered by name) and keeps the ERROR ones; a tenant past it
 * is not seen. No `access` — that is a provider probe per row, which only the list pays for.
 */
const needsYouTenantsSourceQuery = graphql`
  query needsYouTenantsSourceQuery($first: Int!) {
    directoryConnections(first: $first) {
      edges {
        node {
          id
          name
          provider
          lastSyncStatus
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
      data.directoryConnections.edges
        .filter(({ node }) => node.lastSyncStatus === DirectorySyncStatus.ERROR)
        .map(({ node }) =>
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
