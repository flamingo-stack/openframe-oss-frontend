'use client';

import { NotFoundError, type PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantDetailContentQuery as TenantDetailContentQueryType } from '@/__generated__/tenantDetailContentQuery.graphql';
import { ContentErrorBoundary, SectionLoadError, useRetryKey } from '@/app/components/shared';
import { routes } from '@/lib/routes';
import { isReadable } from '../../utils/tenant-presentation';
import { ConsentBlock } from '../consent/consent-block';
import { useCheckConnection } from '../consent/use-check-connection';
import { TenantConsentAlert } from './tenant-consent-alert';
import { TenantConsentIssues } from './tenant-consent-issues';
import { TENANT_DETAIL_TITLE, TenantDetailTitle } from './tenant-detail-title';
import { TenantIntegrationSection } from './tenant-integration-section';
import { TenantIntegrationSectionSkeleton } from './tenant-integration-section-skeleton';
import { TenantSummaryCard } from './tenant-summary-card';

// `directoryConnection` is nullable: an unknown id is a field error, which reaches the page as null.
// The integration rows are not here — they are `TenantIntegrationSection`'s own island (see there).
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
      ...tenantConsentAlert_connection
      ...tenantConsentIssues_connection
    }
  }
`;

interface TenantDetailContentProps {
  id: string;
  actions: PageActionButton[];
}

/** Everything on the details page that waits for the record. */
export function TenantDetailContent({ id, actions }: TenantDetailContentProps) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<TenantDetailContentQueryType>(
    tenantDetailContentQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // A probe that finds the tenant connected flips `access.state` in the store; the integration
  // section below then mounts and reads its own rows.
  const { check, isChecking, verdict } = useCheckConnection(connection?.id ?? null);

  if (!connection) {
    return (
      <>
        <TenantDetailTitle title={TENANT_DETAIL_TITLE} />
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
      </>
    );
  }

  return (
    <>
      <TenantDetailTitle title={connection.name} actions={actions} />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <TenantSummaryCard connection={connection} />
        <TenantConsentAlert connection={connection} />
        <TenantConsentIssues connection={connection} />
        {isReadable(connection.access.state) ? (
          // Its own boundary: a failed live read from the provider loses this section, not the page.
          <ContentErrorBoundary
            fallback={retry => <SectionLoadError message="Couldn't load the integration details." onRetry={retry} />}
          >
            <Suspense fallback={<TenantIntegrationSectionSkeleton provider={connection.provider} />}>
              <TenantIntegrationSection id={connection.id} />
            </Suspense>
          </ContentErrorBoundary>
        ) : (
          <ConsentBlock
            mode="details"
            provider={connection.provider}
            consentUrl={connection.consentUrl}
            checking={isChecking}
            verdict={verdict}
            onCheck={check}
          />
        )}
      </div>
    </>
  );
}
