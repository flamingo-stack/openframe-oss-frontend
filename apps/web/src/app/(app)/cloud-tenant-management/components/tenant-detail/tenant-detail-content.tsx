'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  LoadingScope,
  NotFoundError,
  type PageActionButton,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
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
  /** The module's flag has not answered yet: the content draws in a loading scope and nothing fetches. */
  loading?: boolean;
}

const BODY_CLASS = 'flex flex-1 flex-col gap-[var(--spacing-system-l)]';

/**
 * Everything on the details page that waits for the record, with its own boundary: in its scope (while the record
 * loads, and for the module's flag window) the reader draws its own loading form and nothing fetches.
 */
export function TenantDetailContent({ loading = false, ...props }: TenantDetailContentProps) {
  return (
    <LoadingSuspense live label="Loading tenant" gated={loading}>
      <TenantDetailContentReader {...props} />
    </LoadingSuspense>
  );
}

/**
 * In a loading scope it draws the title as a bar and the card with its labels real and its values as bars, the shape
 * both states share, and does not fetch. Under the card it draws the integration section of a connected tenant (the
 * typical record); a tenant still to connect replaces it with the consent hand-off on arrival.
 *
 * The actions are the page's own, inert: Reconnect and Edit are links to a record the query has not confirmed yet —
 * an unknown id settles into "Tenant not found" with no actions.
 */
function TenantDetailContentReader(props: TenantDetailContentProps) {
  if (useLoadingScope()) {
    return (
      <>
        <TenantDetailTitle title={TENANT_DETAIL_TITLE} loading actions={props.actions} loadingActions />
        <LoadingScope className={BODY_CLASS}>
          <TenantSummaryCard connection={null} />
          {/* The connected tenant's section: most records on this page are connected. */}
          <TenantIntegrationSection id={props.id} provider={null} />
        </LoadingScope>
      </>
    );
  }
  return <TenantDetailContentQuery {...props} />;
}

function TenantDetailContentQuery({ id, actions }: TenantDetailContentProps) {
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
      <div className={BODY_CLASS}>
        <TenantSummaryCard connection={connection} />
        {/* Parts only some tenants have (`data-loading-optional`), read right under the summary they qualify. */}
        <TenantConsentAlert connection={connection} />
        <TenantConsentIssues connection={connection} />
        {isReadable(connection.access.state) ? (
          // Its own boundary: a failed live read from the provider loses this section, not the page.
          <ContentErrorBoundary
            fallback={retry => <SectionLoadError message="Couldn't load the integration details." onRetry={retry} />}
          >
            <TenantIntegrationSection id={connection.id} provider={connection.provider} />
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
