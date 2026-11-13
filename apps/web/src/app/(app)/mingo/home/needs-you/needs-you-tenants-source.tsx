'use client';

import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouTenantsSourceQuery as NeedsYouTenantsSourceQueryType } from '@/__generated__/needsYouTenantsSourceQuery.graphql';
import { useTenantManagementV2Gate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { boundCustomerOptions } from '@/app/(app)/cloud-tenant-management/components/tenant-form/bound-customer';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { failedSyncTenantRow, NEEDS_YOU_CANDIDATES, type ReportSource } from './needs-you-rows';
import { NeedsYouTenantsSourceV1 } from './v1/needs-you-tenants-source-v1';

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
          lastSyncAt
          customers {
            ...boundCustomer_customer
          }
        }
      }
      totalCount
    }
  }
`;

/**
 * Reports `tenants`; renders nothing. Off, main's source and its operation; while the flag reads, nothing: the card
 * stays in its loading form until a source reports.
 */
export function NeedsYouTenantsSource({ onReport }: { onReport: ReportSource }) {
  const gate = useTenantManagementV2Gate();
  if (gate === 'on') return <NeedsYouTenantsSourceV2 onReport={onReport} />;
  if (gate === 'off') return <NeedsYouTenantsSourceV1 onReport={onReport} />;
  return null;
}

function NeedsYouTenantsSourceV2({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<NeedsYouTenantsSourceQueryType>(
    needsYouTenantsSourceQuery,
    { first: NEEDS_YOU_CANDIDATES },
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
          customerName: boundCustomerOptions(node.customers)
            .map(customer => customer.name)
            .join(', '),
          lastSyncAt: node.lastSyncAt,
        }),
      ),
    [data.directoryConnections.edges],
  );

  const count = data.directoryConnections.totalCount;

  // Before paint: a source read from the store answers in the same commit, so a return to
  // the page draws its rows, not the card's loading form, for a frame.
  useLayoutEffect(() => {
    onReport('tenants', { status: 'ready', rows, count });
  }, [onReport, rows, count]);

  return null;
}
