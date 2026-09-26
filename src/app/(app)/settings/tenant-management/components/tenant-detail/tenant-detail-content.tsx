'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, NotFoundError, type PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantDetailContentQuery as TenantDetailContentQueryType } from '@/__generated__/tenantDetailContentQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { routes } from '@/lib/routes';
import { isReadable } from '../../utils/tenant-presentation';
import { ConsentBlock } from '../consent/consent-block';
import { useTenantConsent } from '../consent/use-tenant-consent';
import { TENANT_DETAIL_TITLE, TenantDetailTitle } from './tenant-detail-title';
import { TenantIntegrationSection } from './tenant-integration-section';
import { TenantSummaryCard } from './tenant-summary-card';

// `directoryConnection` is nullable: an unknown id is a field error, which reaches the page as null.
const tenantDetailContentQuery = graphql`
  query tenantDetailContentQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      id
      name
      provider
      consentUrl
      access {
        state
      }
      ...tenantSummaryCard_connection
      ...tenantIntegrationSection_connection
    }
  }
`;

interface TenantDetailContentProps {
  id: string;
  actions?: PageActionButton[];
  loadingActions?: boolean;
  /** Only the owner runs the probe; everyone else reads. */
  canCheck: boolean;
}

/** Everything on the details page that waits for the record. */
export function TenantDetailContent({ id, actions, loadingActions, canCheck }: TenantDetailContentProps) {
  const router = useRouter();
  const retryKey = useRetryKey();
  // Bumped when a probe finds the tenant connected: the integration rows (domains, grant) are read again.
  const [refreshKey, setRefreshKey] = useState(0);
  const { directoryConnection: connection } = useLazyLoadQuery<TenantDetailContentQueryType>(
    tenantDetailContentQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: `${retryKey}:${refreshKey}` },
  );
  const consent = useTenantConsent(connection?.id, {
    onConnected: () => startTransition(() => setRefreshKey(key => key + 1)),
  });

  if (!connection) {
    return (
      <>
        <TenantDetailTitle title={TENANT_DETAIL_TITLE} />
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />
      </>
    );
  }

  return (
    <>
      <TenantDetailTitle title={connection.name} actions={actions} loadingActions={loadingActions} />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <TenantSummaryCard connection={connection} />
        {isReadable(connection.access.state) ? (
          <TenantIntegrationSection connection={connection} />
        ) : (
          <>
            <Alert
              variant="warning"
              className="flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-s)]"
              role="status"
            >
              <span className="shrink-0">
                <AlertTriangleIcon size={24} />
              </span>
              <p className="text-h3">Tenant is still not connected. Data aren&apos;t available yet.</p>
            </Alert>
            <ConsentBlock
              mode="details"
              provider={connection.provider}
              consentUrl={connection.consentUrl}
              checkState={consent.status}
              checkResult={consent.result}
              checkError={consent.error}
              onCheck={consent.check}
              disabled={!canCheck}
            />
          </>
        )}
      </div>
    </>
  );
}
