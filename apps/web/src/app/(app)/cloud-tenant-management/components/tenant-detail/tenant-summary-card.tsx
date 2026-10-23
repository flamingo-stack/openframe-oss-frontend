'use client';

import {
  accessStateTag,
  formatLastRead,
  lastReadAt,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { SquareAvatar, LoadingWhen, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type {
  tenantSummaryCard_connection$data,
  tenantSummaryCard_connection$key,
} from '@/__generated__/tenantSummaryCard_connection.graphql';
import type { tenantSummaryCard_identity$key } from '@/__generated__/tenantSummaryCard_identity.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import { attributionSummary, providerPresentation } from '../../utils/tenant-presentation';

// The two-row identity card of the details page (Figma 3065-17490 / 3051-7340) and its one-row cut
// on Edit / Reconnect (2097-123264). Own row classes: the employee card's `content-md:contents` folds into one row.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-2 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:flex content-md:min-h-20 content-md:items-center content-md:py-0';
const DIVIDED_ROW_CLASSES = 'border-t border-ods-border';

// The cells' labels: static, so the loading card draws them for real.
const LABELS = {
  provider: 'Provider',
  domainName: 'Domain Name',
  customers: 'Customers',
  attribution: 'Attribution',
  users: 'Users',
  status: 'Status',
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
    userCount
    unattributedUserCount
    lastSyncAt
    access {
      state
    }
    customers {
      organization {
        name
        image {
          imageUrl
          hash
        }
      }
    }
  }
`;

type SummaryCustomers = tenantSummaryCard_connection$data['customers'];

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

/**
 * The first customer's logo and name, "+N" for the rest (Figma 3065-17490). A customer whose organization document
 * is gone has nothing to name and is left out; none at all is the empty mark. Before the record answers (`null`) the
 * avatar and a name bar.
 */
function CustomersCell({ customers }: { customers: SummaryCustomers | null }) {
  const named = customers?.flatMap(({ organization }) => (organization ? [organization] : [])) ?? [];
  const [first] = named;
  const more = named.length - 1;
  return (
    <InfoCell
      label={LABELS.customers}
      skeletonWidth="w-44"
      icon={
        // The loading card draws the avatar's own skeleton; a loaded tenant with no customer has no logo to show.
        customers == null || first ? (
          <SquareAvatar
            src={first ? getFullImageUrl(first.image?.imageUrl, first.image?.hash) : undefined}
            alt={first?.name}
            fallback={first?.name ?? ''}
            size="xs"
            variant="square"
          />
        ) : null
      }
      value={
        first && more > 0 ? (
          <>
            {first.name} <span className="text-ods-text-secondary">+{more}</span>
          </>
        ) : (
          first?.name
        )
      }
    />
  );
}

/** "8 of 96 unattributed" in the warning colour, or "Fully attributed"; the empty mark until the first sync. */
function AttributionCell({ data }: { data: tenantSummaryCard_connection$data | null }) {
  const summary = data ? attributionSummary(data.unattributedUserCount, data.userCount) : null;
  return (
    <InfoCell
      label={LABELS.attribution}
      skeletonWidth="w-40"
      value={summary?.warning ? <span className="text-ods-warning">{summary.text}</span> : summary?.text}
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
 * steady state, so the page does not jump when such a record lands. Every cell is the real `InfoCell`, and the
 * customer's avatar the real `SquareAvatar`, each drawing its own loading state.
 */
export function TenantSummaryCard({ connection }: { connection: tenantSummaryCard_connection$key | null }) {
  const scoped = useLoadingScope();
  const fragment = useFragment(tenantSummaryCardFragment, connection);
  const data = scoped ? null : fragment;
  // `Instant` scalars are untyped (`any`); `unknown` keeps them out of the rest of the render.
  const lastSyncAt: unknown = data?.lastSyncAt;
  return (
    <LoadingWhen loading={data == null}>
      <div className={CARD_CLASSES}>
        <div className={ROW_CLASSES}>
          <ProviderCell provider={data?.provider ?? null} />
          <CustomersCell customers={data?.customers ?? null} />
        </div>
        <div className={cn(ROW_CLASSES, DIVIDED_ROW_CLASSES)}>
          <AttributionCell data={data ?? null} />
          <InfoCell label={LABELS.users} value={data?.userCount?.toString()} skeletonWidth="w-16" />
          <InfoCell
            label={LABELS.status}
            // No label while the tenant loads: the tag draws its own skeleton in the cell's scope.
            value={<Tag {...(data ? accessStateTag(data.access.state) : { label: null })} />}
          />
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
