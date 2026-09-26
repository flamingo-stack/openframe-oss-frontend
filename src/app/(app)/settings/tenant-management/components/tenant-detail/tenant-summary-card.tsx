'use client';

import { Skeleton, SquareAvatar, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { tenantSummaryCard_connection$key } from '@/__generated__/tenantSummaryCard_connection.graphql';
import type { tenantSummaryCard_identity$key } from '@/__generated__/tenantSummaryCard_identity.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import {
  accessStateTag,
  formatConnectedAt,
  formatLastRead,
  isReadable,
  lastReadAt,
  providerPresentation,
} from '../../utils/tenant-presentation';

// The two-row identity card of the details page (Figma 2097-140910 / 2097-119207) and its one-row cut
// on Edit / Reconnect (2097-123264). Own row classes: the employee card's `md:contents` folds into one row.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-2 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] md:flex md:min-h-20 md:items-center md:py-0';
const DIVIDED_ROW_CLASSES = 'border-t border-ods-border';

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
  return <InfoCell label="Provider" value={<IconValue icon={<Logo size={24} />}>{label}</IconValue>} />;
}

function ConnectedCell({ connectedAt }: { connectedAt: unknown }) {
  const parts = formatConnectedAt(typeof connectedAt === 'string' ? connectedAt : null);
  return (
    <InfoCell
      label="Connected"
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

/** The Edit / Reconnect cut: provider and domain only. */
export function TenantIdentityCard({ connection }: { connection: tenantSummaryCard_identity$key }) {
  const { provider, domain } = useFragment(tenantSummaryCardIdentityFragment, connection);
  return (
    <div className={CARD_CLASSES}>
      <div className={ROW_CLASSES}>
        <ProviderCell provider={provider} />
        <InfoCell label="Domain Name" value={domain} />
      </div>
    </div>
  );
}

export function TenantSummaryCard({ connection }: { connection: tenantSummaryCard_connection$key }) {
  const data = useFragment(tenantSummaryCardFragment, connection);
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
        {!connected && <InfoCell label="Domain" value={data.domain} />}
        <InfoCell
          label="Customer"
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
        <InfoCell label="Users" value={data.userCount?.toString()} />
        <InfoCell label="Status" value={<Tag {...accessStateTag(data.access.state)} />} />
        <ConnectedCell connectedAt={connectedAt} />
        <InfoCell label="Last Read" value={formatLastRead(lastReadAt({ lastSyncAt }))} />
      </div>
    </div>
  );
}

function CellSkeleton({ valueClassName }: { valueClassName: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Skeleton className={valueClassName} />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/** Same rows and cell count as the loaded card, so the page does not jump when the record lands. */
export function TenantSummaryCardSkeleton({ identityOnly = false }: { identityOnly?: boolean }) {
  return (
    <div className={CARD_CLASSES}>
      <div className={ROW_CLASSES}>
        <CellSkeleton valueClassName="h-6 w-36" />
        <CellSkeleton valueClassName="h-6 w-44" />
      </div>
      {!identityOnly && (
        <div className={cn(ROW_CLASSES, DIVIDED_ROW_CLASSES)}>
          <CellSkeleton valueClassName="h-6 w-16" />
          <CellSkeleton valueClassName="h-8 w-28 rounded-md" />
          <CellSkeleton valueClassName="h-6 w-40" />
          <CellSkeleton valueClassName="h-6 w-28" />
        </div>
      )}
    </div>
  );
}
