'use client';

import {
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { reconnectTenantViewQuery as ReconnectTenantViewQueryType } from '@/__generated__/reconnectTenantViewQuery.graphql';
import type { reconnectTenantViewStartConsentMutation as StartConsentMutationType } from '@/__generated__/reconnectTenantViewStartConsentMutation.graphql';
import { SectionLoadError, useRetryKey } from '@/app/components/shared';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ConsentBlock } from '../consent/consent-block';
import { useTenantConsent } from '../consent/use-tenant-consent';
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

const startConsentMutation = graphql`
  mutation reconnectTenantViewStartConsentMutation($connectionId: ID!) {
    startDirectoryConsent(connectionId: $connectionId) {
      connection {
        id
        consentUrl
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const MINT_FAILED = 'Could not create a consent link';

function ReconnectTenantContent({ id }: { id: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const retryKey = useRetryKey();
  // Not network-only: under StrictMode Relay's remount refetch re-suspends it forever (a request every ~300ms).
  const { directoryConnection: connection } = useLazyLoadQuery<ReconnectTenantViewQueryType>(
    reconnectTenantViewQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const [commitStartConsent, isMinting] = useMutation<StartConsentMutationType>(startConsentMutation);
  const [mintFailed, setMintFailed] = useState(false);
  const mintStartedRef = useRef(false);
  const subscriptionOpen = useSubscriptionOpen();
  const consent = useTenantConsent(connection?.id);
  const connectionId = connection?.id ?? null;
  const outstandingUrl = connection?.consentUrl ?? null;

  // Stable: the mount effect depends on it, and Retry reuses it.
  const mint = useCallback(
    (target: string) => {
      const fail = (message: string) => {
        setMintFailed(true);
        toast({ title: MINT_FAILED, description: message, variant: 'destructive' });
      };
      commitStartConsent({
        variables: { connectionId: target },
        onCompleted: ({ startDirectoryConsent: { connection: minted, userErrors } }) => {
          const [refusal] = userErrors;
          if (refusal || !minted?.consentUrl) fail(refusal?.message || 'Try again in a moment.');
        },
        onError: error => fail(getRelayErrorMessage(error, 'Try again in a moment.')),
      });
    },
    [commitStartConsent, toast],
  );

  // An outstanding link stays: minting would void the one the customer's admin may already hold.
  // No link → the page IS the request for one. Ref guard for StrictMode; gated, as nothing clicked.
  useEffect(() => {
    if (!connectionId || outstandingUrl || !subscriptionOpen || mintStartedRef.current) return;
    mintStartedRef.current = true;
    mint(connectionId);
  }, [connectionId, outstandingUrl, subscriptionOpen, mint]);

  const retryMint = () => {
    if (!connectionId || isMinting) return;
    setMintFailed(false);
    mint(connectionId);
  };

  const actions: PageActionButton[] = [
    {
      label: 'Save Integration',
      variant: 'accent',
      // Nothing of its own to write: back to the details page, which the probe has already updated.
      onClick: () => safeBackOrReplace(router, routes.settings.tenantDetails(id)),
      disabled: !connection || isMinting || consent.isChecking,
    },
  ];

  return (
    <PageLayout
      title="Reconnect Tenant Integration"
      backButton={{ label: 'Back to Integrations', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      {connection ? (
        <>
          <TenantIdentityCard connection={connection} />
          {mintFailed && !outstandingUrl && <SectionLoadError message={`${MINT_FAILED}.`} onRetry={retryMint} />}
          <ConsentBlock
            mode="reconnect"
            provider={connection.provider}
            consentUrl={outstandingUrl}
            checkState={consent.status}
            checkResult={consent.result}
            checkError={consent.error}
            onCheck={consent.check}
            disabled={isMinting}
          />
        </>
      ) : (
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />
      )}
    </PageLayout>
  );
}

/** `/settings/tenant-management/reconnect` (Figma 2108-81037): the identity card over the re-approve consent card. */
export function ReconnectTenantView({ id }: { id: string }) {
  return (
    <Suspense fallback={<TenantFormSkeleton variant="reconnect" />}>
      <ReconnectTenantContent id={id} />
    </Suspense>
  );
}
