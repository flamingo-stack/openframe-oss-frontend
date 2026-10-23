'use client';

import {
  NotFoundError,
  type PageActionButton,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { reconnectTenantViewQuery as ReconnectTenantViewQueryType } from '@/__generated__/reconnectTenantViewQuery.graphql';
import { LiveSuspense, SectionLoadError, useRetryKey } from '@/app/components/shared';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ConsentBlock } from '../consent/consent-block';
import { useCheckConnection } from '../consent/use-check-connection';
import { MINT_FAILED, useStartConsent } from '../consent/use-start-consent';
import { SAVE_PLACEHOLDER, TenantFormFrame } from '../shared/tenant-form-frame';
import { TenantIdentityCard } from '../tenant-detail/tenant-summary-card';

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

/**
 * The page's record and everything that waits for it. In a loading scope (the view's Suspense fallback, or the
 * module's flag window) the chrome is real, the identity card and the consent block draw their own loading states,
 * and nothing is read or minted.
 */
function ReconnectTenantContent({ id }: { id: string }) {
  if (useLoadingScope()) {
    return (
      <TenantFormFrame title="Reconnect Tenant Integration">
        <TenantIdentityCard connection={null} />
        <ConsentBlock mode="reconnect" provider={null} />
      </TenantFormFrame>
    );
  }
  return <ReconnectTenantContentQuery id={id} />;
}

function ReconnectTenantContentQuery({ id }: { id: string }) {
  const router = useRouter();
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
      ...SAVE_PLACEHOLDER,
      // Nothing of its own to write: back to the details page, which the probe has already updated.
      onClick: () => safeBackOrReplace(router, routes.cloudTenantManagement.details(id)),
      disabled: !connection || isMinting || isChecking,
    },
  ];

  return (
    <TenantFormFrame title="Reconnect Tenant Integration" actions={actions}>
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
    </TenantFormFrame>
  );
}

/** `/cloud-tenant-management/reconnect` (Figma 2108-81037): the identity card over the re-approve consent card. */
export function ReconnectTenantView({ id }: { id: string }) {
  return (
    <LiveSuspense label="Loading tenant">
      <ReconnectTenantContent id={id} />
    </LiveSuspense>
  );
}
