'use client';

import {
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { reconnectTenantViewQuery as ReconnectTenantViewQueryType } from '@/__generated__/reconnectTenantViewQuery.graphql';
import { SectionLoadError, useRetryKey } from '@/app/components/shared';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ConsentBlock } from '../consent/consent-block';
import { useCheckConnection } from '../consent/use-check-connection';
import { MINT_FAILED, useStartConsent } from '../consent/use-start-consent';
import { TenantIdentityCard } from '../tenant-detail/tenant-summary-card';
import { TenantFormSkeleton } from '../tenant-form/tenant-form-skeleton';

const reconnectTenantViewQuery = graphql`
  query reconnectTenantViewQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      id
      provider
      consentUrl
      ...tenantSummaryCard_identity
    }
  }
`;

function ReconnectTenantContent({ id }: { id: string }) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  const retryKey = useRetryKey();
  // `store-or-network`: the mint below fires on mount, and a background refetch of `consentUrl` that
  // landed after it would write the old, empty value back over the fresh link. The store holds what
  // the details page just read; a reload fetches. (Not network-only either: under StrictMode Relay's
  // remount refetch re-suspends it forever, a request every ~300ms.)
  const { directoryConnection: connection } = useLazyLoadQuery<ReconnectTenantViewQueryType>(
    reconnectTenantViewQuery,
    { id },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );
  const connectionId = connection?.id ?? null;
  const outstandingUrl = connection?.consentUrl ?? null;
  // An outstanding link stays: minting would void the one the customer's admin may already hold.
  // No link → the page IS the request for one.
  const { mint, isMinting, mintFailed } = useStartConsent(connectionId, {
    autoMintWhen: connectionId !== null && !outstandingUrl,
  });
  const { check, isChecking, verdict } = useCheckConnection(connectionId);

  const actions: PageActionButton[] = [
    {
      label: 'Save Integration',
      variant: 'accent',
      // Nothing of its own to write: back to the details page, which the probe has already updated.
      onClick: () => safeBackOrReplace(router, routes.cloudTenantManagement.details(id)),
      disabled: !connection || isMinting || isChecking,
    },
  ];

  return (
    <PageLayout
      title="Reconnect Tenant Integration"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      {connection ? (
        <>
          <TenantIdentityCard connection={connection} />
          {mintFailed && !isMinting && !outstandingUrl && (
            <SectionLoadError message={`${MINT_FAILED}.`} onRetry={() => mint()} />
          )}
          <ConsentBlock
            mode="reconnect"
            provider={connection.provider}
            consentUrl={outstandingUrl}
            checking={isChecking}
            verdict={verdict}
            onCheck={check}
            disabled={isMinting}
          />
        </>
      ) : (
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
      )}
    </PageLayout>
  );
}

/** `/cloud-tenant-management/reconnect` (Figma 2108-81037): the identity card over the re-approve consent card. */
export function ReconnectTenantView({ id }: { id: string }) {
  return (
    <Suspense fallback={<TenantFormSkeleton variant="reconnect" />}>
      <ReconnectTenantContent id={id} />
    </Suspense>
  );
}
