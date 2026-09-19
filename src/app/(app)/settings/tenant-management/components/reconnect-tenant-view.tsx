'use client';

import {
  LoadError,
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { getErrorMessage } from '@/lib/handle-api-error';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useStartTenantConsent, useTenantConnection } from '../hooks/use-tenant-connections';
import { useTenantConsent } from '../hooks/use-tenant-consent';
import { ConsentBlock } from './consent/consent-block';
import { TenantFormSkeleton } from './tenant-page-skeletons';
import { TenantSummaryCard } from './tenant-summary-card';

const LOAD_ERROR_MESSAGE = "Couldn't load this tenant.";

interface ReconnectTenantViewProps {
  id: string;
}

/**
 * `/settings/tenant-management/reconnect` (Figma 2108-81037): the identity
 * card over the consent card with the re-approve wording. A fresh consent
 * link is minted as soon as the record is known — the page IS the request for
 * one. The guard is the mutation's own status, not a ref: a ref outlives a
 * StrictMode remount while the mutation observer does not, so a ref-guarded
 * mint landed on an observer nobody was rendering any more and the page waited
 * for a link that had already been issued. Save has nothing of its own to
 * write; it returns to the details page, which the probe has already refreshed.
 */
export function ReconnectTenantView({ id }: ReconnectTenantViewProps) {
  const { toast } = useToast();
  const router = useRouter();
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const query = useTenantConnection(id);
  const { isLoading, isOffline, error, canClaimEmpty } = queryState(query);
  const connection = query.data ?? null;
  const mint = useStartTenantConsent();
  const consent = useTenantConsent(connection?.id);

  const { mutate: startConsent, isIdle: mintNotStarted } = mint;
  const connectionId = connection?.id ?? null;
  useEffect(() => {
    if (!connectionId || !mintNotStarted) return;
    startConsent(connectionId, {
      onError: cause => {
        toast({
          title: 'Could not create a consent link',
          description: getErrorMessage(cause) || 'Try again in a moment.',
          variant: 'destructive',
        });
      },
    });
  }, [connectionId, mintNotStarted, startConsent, toast]);

  if (error || isOffline) {
    return <LoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, () => void query.refetch())} />;
  }
  if (isLoading || !canClaimEmpty) {
    return <TenantFormSkeleton variant="reconnect" />;
  }
  if (!connection) {
    return <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />;
  }

  // The minted link, never the record's: the record may still carry a stale one
  // from before, and a refetch mid-probe must not swap the card under the user.
  const consentUrl = mint.data?.consentUrl ?? null;
  const actions: PageActionButton[] = [
    {
      label: 'Save Integration',
      variant: 'accent',
      onClick: () => safeBackOrReplace(router, routes.settings.tenantDetails(connection.id)),
      disabled: mint.isPending || consent.isChecking,
    },
  ];

  return (
    <PageLayout
      title="Reconnect Tenant Integration"
      backButton={{ label: 'Back to Integrations', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <TenantSummaryCard connection={connection} identityOnly />
      <ConsentBlock
        mode="reconnect"
        provider={connection.provider}
        consentUrl={consentUrl}
        checkState={consent.status}
        checkResult={consent.result}
        checkError={consent.error}
        onCheck={consent.check}
        disabled={mint.isPending}
      />
    </PageLayout>
  );
}
