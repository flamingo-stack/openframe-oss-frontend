'use client';

import {
  AlertTriangleIcon,
  PenEditIcon,
  Refresh02VrIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Alert,
  InfoSection,
  type InfoSectionRow,
  LoadError,
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useTenantConnection } from '../hooks/use-tenant-connections';
import { useTenantConsent } from '../hooks/use-tenant-consent';
import type { TenantConnection } from '../types/tenant-connection';
import { capabilityLabels, EMPTY_VALUE, isReadable, providerPresentation } from '../utils/tenant-presentation';
import { ConsentBlock } from './consent/consent-block';
import { TenantDetailsSkeleton } from './tenant-page-skeletons';
import { TenantSummaryCard } from './tenant-summary-card';

const LOAD_ERROR_MESSAGE = "Couldn't load this tenant.";

/** A right-aligned value that may take several lines — `InfoSection`'s text values truncate. */
function MultiLineValue({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col items-end text-right text-ods-text-primary text-h4">
      {lines.map(line => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** The "INTEGRATION" section (Figma 2097-140910), row for row. */
function integrationRows(connection: TenantConnection): InfoSectionRow[] {
  const { directoryIdLabel, authorisedBy } = providerPresentation(connection.provider);
  const domainNames = connection.domains.map(domain => domain.name);
  const primaryDomain = connection.domains.find(domain => domain.primary)?.name ?? connection.domain;
  const scopes = capabilityLabels(connection.access.capabilities);
  return [
    { id: 'primary-domain', label: 'Primary domain', value: { text: primaryDomain } },
    {
      id: 'domains',
      label: 'Domains',
      value:
        domainNames.length > 1
          ? { type: 'custom', content: <MultiLineValue lines={domainNames} /> }
          : { text: domainNames[0] ?? primaryDomain },
    },
    { id: 'directory-id', label: directoryIdLabel, value: { text: connection.directoryId ?? EMPTY_VALUE } },
    { id: 'granted-by', label: 'Granted by', value: { text: connection.grantedBy ?? EMPTY_VALUE } },
    {
      id: 'scopes',
      label: 'Scopes held',
      // Ten-plus scopes must wrap (Figma comment #109), so this is not a text value.
      value: {
        type: 'custom',
        content: (
          <span className="text-right text-ods-text-primary text-h4 [overflow-wrap:anywhere]">
            {scopes.length > 0 ? scopes.join(', ') : EMPTY_VALUE}
          </span>
        ),
      },
    },
    { id: 'authorised-by', label: 'Authorised by', value: { text: authorisedBy } },
  ];
}

interface TenantDetailsViewProps {
  id: string;
}

export function TenantDetailsView({ id }: TenantDetailsViewProps) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const ownerGate = useOwnerGate();
  const query = useTenantConnection(id);
  const { isLoading, isOffline, error, canClaimEmpty } = queryState(query);
  const connection = query.data ?? null;
  const consent = useTenantConsent(connection?.id);

  if (error || isOffline) {
    return <LoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, () => void query.refetch())} />;
  }
  if (isLoading || !canClaimEmpty || ownerGate === 'loading') {
    return <TenantDetailsSkeleton />;
  }
  if (!connection) {
    // `canClaimEmpty` holds here: the query answered, and the answer is "no such id".
    return <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />;
  }

  const isOwner = ownerGate === 'owner';
  // Reconnect and Edit change the tenant's grant and binding — owners only
  // everyone else reads.
  const actions: PageActionButton[] | undefined = isOwner
    ? [
        {
          label: 'Reconnect',
          icon: <Refresh02VrIcon className="h-5 w-5" />,
          variant: 'outline',
          href: routes.settings.tenantReconnect(connection.id),
        },
        {
          label: 'Edit Integration',
          icon: <PenEditIcon className="h-5 w-5" />,
          variant: 'outline',
          href: routes.settings.tenantEdit(connection.id),
        },
      ]
    : undefined;

  const connected = isReadable(connection.access.state);

  return (
    <PageLayout
      title={connection.name}
      actions={actions}
      actionsVariant="icon-buttons"
      backButton={{ label: 'Back', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <TenantSummaryCard connection={connection} />
      {connected ? (
        <InfoSection title="Integration" rows={integrationRows(connection)} />
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
            disabled={!isOwner}
          />
        </>
      )}
    </PageLayout>
  );
}
