'use client';

import { Skeleton, SquareAvatar, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import type { TenantConnection } from '../types/tenant-connection';
import {
  accessStateTag,
  EMPTY_VALUE,
  formatConnectedAt,
  formatLastRead,
  isReadable,
  lastReadAt,
  providerPresentation,
} from '../utils/tenant-presentation';

// The two-row identity card of the details page (Figma 2097-140910 /
// 2097-119207) and its one-row cut on Edit / Reconnect (2097-123264). Built
// from the shared `InfoCell`; the row classes are its own because the employee
// card's `md:contents` folds everything into ONE row on desktop and this card
// has two. Below `md` each row is a two-column grid.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-2 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] md:flex md:min-h-20 md:items-center md:py-0';
const DIVIDED_ROW_CLASSES = 'border-t border-ods-border';

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

function CustomerCell({ connection }: { connection: TenantConnection }) {
  const { organization } = connection;
  return (
    <InfoCell
      label="Customer"
      value={
        <IconValue
          icon={
            <SquareAvatar
              src={getFullImageUrl(organization.imageUrl)}
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
  );
}

function ConnectedCell({ connectedAt }: { connectedAt: string | null | undefined }) {
  const parts = formatConnectedAt(connectedAt);
  return (
    <InfoCell
      label="Connected"
      value={
        parts ? (
          <>
            {parts.date} <span className="text-ods-text-secondary">{parts.time}</span>
          </>
        ) : (
          EMPTY_VALUE
        )
      }
    />
  );
}

interface TenantSummaryCardProps {
  connection: TenantConnection;
  /** The Edit / Reconnect cut: provider and domain only. */
  identityOnly?: boolean;
}

export function TenantSummaryCard({ connection, identityOnly = false }: TenantSummaryCardProps) {
  if (identityOnly) {
    return (
      <div className={CARD_CLASSES}>
        <div className={ROW_CLASSES}>
          <ProviderCell provider={connection.provider} />
          <InfoCell label="Domain Name" value={connection.domain} />
        </div>
      </div>
    );
  }

  const connected = isReadable(connection.access.state);
  return (
    <div className={CARD_CLASSES}>
      <div className={ROW_CLASSES}>
        <ProviderCell provider={connection.provider} />
        {/* Before the first consent the domain is the only identity the tenant has (Figma 2097-119207). */}
        {!connected && <InfoCell label="Domain" value={connection.domain} />}
        <CustomerCell connection={connection} />
      </div>
      <div className={cn(ROW_CLASSES, DIVIDED_ROW_CLASSES)}>
        {/* The card's caption already says "Users" (frame 2097-140910); the list cell is where the unit belongs. */}
        <InfoCell label="Users" value={connection.userCount == null ? EMPTY_VALUE : String(connection.userCount)} />
        <InfoCell label="Status" value={<Tag {...accessStateTag(connection.access.state)} />} />
        <ConnectedCell connectedAt={connection.connectedAt} />
        <InfoCell label="Last Read" value={formatLastRead(lastReadAt(connection))} />
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
