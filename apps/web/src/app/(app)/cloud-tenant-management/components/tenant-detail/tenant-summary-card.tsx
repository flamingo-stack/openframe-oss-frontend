'use client';

import {
  accessStateTag,
  formatLastRead,
  lastReadAt,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { SquareAvatar, LoadingWhen, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { tenantSummaryCard_connection$key } from '@/__generated__/tenantSummaryCard_connection.graphql';
import type { tenantSummaryCard_identity$key } from '@/__generated__/tenantSummaryCard_identity.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import { formatConnectedAt, providerPresentation } from '../../utils/tenant-presentation';

// The two-row identity card of the details page (Figma 2097-140910 / 2097-119207) and its one-row cut
// on Edit / Reconnect (2097-123264). Own row classes: the employee card's `content-md:contents` folds into one row.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-2 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:flex content-md:min-h-20 content-md:items-center content-md:py-0';
const DIVIDED_ROW_CLASSES = 'border-t border-ods-border';

// The cells' labels: static, so the loading card draws them for real.
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

/** The provider logo's box: `MediaSkeleton.Icon size="md"` (h-6 w-6) is its loading shape. */
const PROVIDER_LOGO_PX = 24;

/** The provider: its logo and name. Before the record answers (`null`) the logo's box and a name bar. */
function ProviderCell({ provider }: { provider: string | null }) {
  const { Logo, label } = providerPresentation(provider);
  return (
    <InfoCell
      label={LABELS.provider}
      skeletonWidth="w-36"
      icon={provider != null && <Logo size={PROVIDER_LOGO_PX} />}
      iconSkeleton={{ size: 'md' }}
      value={provider == null ? null : label}
    />
  );
}

function ConnectedCell({ connectedAt }: { connectedAt: unknown }) {
  const parts = formatConnectedAt(typeof connectedAt === 'string' ? connectedAt : null);
  return (
    <InfoCell
      label={LABELS.connected}
      skeletonWidth="w-40"
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

/** The Edit / Reconnect cut: provider and domain only. With no record yet (a loading scope) it draws its own loading state. */
export function TenantIdentityCard({ connection }: { connection: tenantSummaryCard_identity$key | null }) {
  const scoped = useLoadingScope();
  const fragment = useFragment(tenantSummaryCardIdentityFragment, connection);
  const data = scoped ? null : fragment;
  return (
    <LoadingWhen loading={data == null}>
      <div className={CARD_CLASSES}>
        <div className={ROW_CLASSES}>
          <ProviderCell provider={data?.provider ?? null} />
          <InfoCell label={LABELS.domainName} value={data?.domain} skeletonWidth="w-44" />
        </div>
      </div>
    </LoadingWhen>
  );
}

/**
 * The details page's card. Before the record answers (a loading scope) it is the connected card, the details page's
 * steady state, so the page does not jump when such a record lands. Every cell is the real `InfoCell`, and the customer's avatar the real `SquareAvatar`, each drawing
 * its own loading state.
 */
export function TenantSummaryCard({ connection }: { connection: tenantSummaryCard_connection$key | null }) {
  const scoped = useLoadingScope();
  const fragment = useFragment(tenantSummaryCardFragment, connection);
  const data = scoped ? null : fragment;
  const organization = data?.organization ?? null;
  // `Instant` scalars are untyped (`any`); `unknown` keeps them out of the rest of the render.
  const connectedAt: unknown = data?.connectedAt;
  const lastSyncAt: unknown = data?.lastSyncAt;
  return (
    <LoadingWhen loading={data == null}>
      <div className={CARD_CLASSES}>
        <div className={ROW_CLASSES}>
          <ProviderCell provider={data?.provider ?? null} />
          {/* Always drawn, so the card has one cell count loading and loaded: before the first consent the domain is
              the only identity the tenant has (Figma 2097-119207). */}
          <InfoCell label={LABELS.domain} value={data?.domain} skeletonWidth="w-44" />
          <InfoCell
            label={LABELS.customer}
            skeletonWidth="w-44"
            icon={
              <SquareAvatar
                src={organization ? getFullImageUrl(organization.image?.imageUrl, organization.image?.hash) : undefined}
                alt={organization?.name}
                fallback={organization?.name ?? ''}
                size="xs"
                variant="square"
              />
            }
            value={organization?.name}
          />
        </div>
        <div className={cn(ROW_CLASSES, DIVIDED_ROW_CLASSES)}>
          <InfoCell label={LABELS.users} value={data?.userCount?.toString()} skeletonWidth="w-16" />
          <InfoCell
            label={LABELS.status}
            value={data ? <Tag {...accessStateTag(data.access.state)} /> : null}
            valueSkeleton={<Tag label="" />}
          />
          <ConnectedCell connectedAt={connectedAt} />
          <InfoCell
            label={LABELS.lastRead}
            value={data ? formatLastRead(lastReadAt({ lastSyncAt })) : null}
            skeletonWidth="w-28"
          />
        </div>
      </div>
    </LoadingWhen>
  );
}
