'use client';

import {
  accessStateTag,
  formatLastRead,
  lastReadAt,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { SquareAvatar, Tag, TagSkeleton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { tenantSummaryCard_connection$key } from '@/__generated__/tenantSummaryCard_connection.graphql';
import type { tenantSummaryCard_identity$key } from '@/__generated__/tenantSummaryCard_identity.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import { formatConnectedAt, isReadable, providerPresentation } from '../../utils/tenant-presentation';

// The two-row identity card of the details page (Figma 2097-140910 / 2097-119207) and its one-row cut
// on Edit / Reconnect (2097-123264). Own row classes: the employee card's `content-md:contents` folds into one row.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-2 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:flex content-md:min-h-20 content-md:items-center content-md:py-0';
const DIVIDED_ROW_CLASSES = 'border-t border-ods-border';

// The cells' labels, shared with the skeleton: they are static, so the loading card draws them for real.
const LABELS = {
  provider: 'Provider',
  domain: 'Domain',
  domainName: 'Domain Name',
  customer: 'Customer',
  users: 'Users',
  status: 'Status',
  connected: 'Connected',
  lastRead: 'Last Read',
} as const;

// The identity cut reads no `access`: that field is a provider probe, and Edit / Reconnect never show it.
const tenantSummaryCardIdentityFragment = graphql`
  fragment tenantSummaryCard_identity on DirectoryConnection {
    provider
    domain
  }
`;

const tenantSummaryCardFragment = graphql`
  fragment tenantSummaryCard_connection on DirectoryConnection {
    provider
    domain
    userCount
    connectedAt
    lastSyncAt
    access {
      state
    }
    organization {
      name
      image {
        imageUrl
        hash
      }
    }
  }
`;

function IconValue({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function ProviderCell({ provider }: { provider: string }) {
  const { Logo, label } = providerPresentation(provider);
  return <InfoCell label={LABELS.provider} value={<IconValue icon={<Logo size={24} />}>{label}</IconValue>} />;
}

function ConnectedCell({ connectedAt }: { connectedAt: unknown }) {
  const parts = formatConnectedAt(typeof connectedAt === 'string' ? connectedAt : null);
  return (
    <InfoCell
      label={LABELS.connected}
      value={
        parts ? (
          <>
            {parts.date} <span className="text-ods-text-secondary">{parts.time}</span>
          </>
        ) : null
      }
    />
  );
}

/** The Edit / Reconnect cut: provider and domain only. Null before the record answers (its loading state). */
export function TenantIdentityCard({ connection }: { connection: tenantSummaryCard_identity$key | null }) {
  const loading = useLoadingScope();
  const data = useFragment(tenantSummaryCardIdentityFragment, connection);
  if (loading || !data) {
    return <TenantSummaryCardSkeleton identityOnly />;
  }
  const { provider, domain } = data;
  return (
    <div className={CARD_CLASSES}>
      <div className={ROW_CLASSES}>
        <ProviderCell provider={provider} />
        <InfoCell label={LABELS.domainName} value={domain} />
      </div>
    </div>
  );
}

/** The details page's card. Null before the record answers (its loading state). */
export function TenantSummaryCard({ connection }: { connection: tenantSummaryCard_connection$key | null }) {
  const loading = useLoadingScope();
  const data = useFragment(tenantSummaryCardFragment, connection);
  if (loading || !data) {
    return <TenantSummaryCardSkeleton />;
  }
  const { organization } = data;
  // `Instant` scalars are untyped (`any`); `unknown` keeps them out of the rest of the render.
  const connectedAt: unknown = data.connectedAt;
  const lastSyncAt: unknown = data.lastSyncAt;
  const connected = isReadable(data.access.state);
  return (
    <div className={CARD_CLASSES}>
      <div className={ROW_CLASSES}>
        <ProviderCell provider={data.provider} />
        {/* Before the first consent the domain is the only identity the tenant has (Figma 2097-119207). */}
        {!connected && <InfoCell label={LABELS.domain} value={data.domain} />}
        <InfoCell
          label={LABELS.customer}
          value={
            <IconValue
              icon={
                <SquareAvatar
                  src={getFullImageUrl(organization.image?.imageUrl, organization.image?.hash)}
                  alt={organization.name}
                  fallback={organization.name}
                  size="xs"
                  variant="square"
                />
              }
            >
              {organization.name}
            </IconValue>
          }
        />
      </div>
      <div className={cn(ROW_CLASSES, DIVIDED_ROW_CLASSES)}>
        <InfoCell label={LABELS.users} value={data.userCount?.toString()} />
        <InfoCell label={LABELS.status} value={<Tag {...accessStateTag(data.access.state)} />} />
        <ConnectedCell connectedAt={connectedAt} />
        <InfoCell label={LABELS.lastRead} value={formatLastRead(lastReadAt({ lastSyncAt }))} />
      </div>
    </div>
  );
}

/**
 * The connected card's rows, cells and labels — the details page's steady state — so the page does not
 * jump when such a record lands. A tenant still awaiting consent adds its Domain cell on arrival. Every cell is the
 * real `InfoCell` drawing its own loading state (label real, value a text bar): a null record is this card's loading
 * state even outside a loading scope.
 */
function TenantSummaryCardSkeleton({ identityOnly = false }: { identityOnly?: boolean }) {
  return (
    <div className={CARD_CLASSES}>
      <div className={ROW_CLASSES}>
        <InfoCell label={LABELS.provider} value={null} loading skeletonWidth="w-36" />
        <InfoCell
          label={identityOnly ? LABELS.domainName : LABELS.customer}
          value={null}
          loading
          skeletonWidth="w-44"
        />
      </div>
      {!identityOnly && (
        <div className={cn(ROW_CLASSES, DIVIDED_ROW_CLASSES)}>
          <InfoCell label={LABELS.users} value={null} loading skeletonWidth="w-16" />
          <InfoCell label={LABELS.status} value={null} loading valueSkeleton={<TagSkeleton />} />
          <InfoCell label={LABELS.connected} value={null} loading skeletonWidth="w-40" />
          <InfoCell label={LABELS.lastRead} value={null} loading skeletonWidth="w-28" />
        </div>
      )}
    </div>
  );
}
