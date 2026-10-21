'use client';

import { DashboardInfoCard, EntityImage, TitleBlock, TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { IdCardIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { EmptyState } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { pluralize } from '@/lib/pluralize';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useCustomersOverview } from '../hooks/use-customers-overview';

/** How many customers the section lists: the request's limit, so the skeleton draws the same count. */
export const CUSTOMERS_OVERVIEW_LIMIT = 10;

const CUSTOMER_ROW_KEYS = Array.from({ length: CUSTOMERS_OVERVIEW_LIMIT }, (_, index) => `row-${index}`);

/** One row's grid: the customer card (full row on mobile/tablet, half from `lg`) then its two device cards. */
const CUSTOMER_ROW_CLASS = 'grid grid-cols-2 items-stretch gap-[var(--spacing-system-mf)] content-lg:grid-cols-4';

// Exact wrapper of the core `DashboardInfoCard` (its `baseClassName`), for the customer card, which has no static
// title. The device cards are `DashboardInfoCard` itself, in its `loading` state.
const INFO_CARD_CLASS =
  'flex h-16 items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)] transition-all content-md:h-[104px] content-md:gap-[var(--spacing-system-m)] content-md:p-[var(--spacing-system-m)]';

/**
 * The customer card while it loads: the whole card is per-customer data (logo, name, device count, website), so
 * it is bars in the real card's icon slot (32 → 56px tile) and name/subtitle rows.
 */
function CustomerInfoCardSkeleton() {
  return (
    <div className={cn(INFO_CARD_CLASS, 'col-span-2')}>
      <UnifiedSkeleton className="size-8 shrink-0 rounded-sm content-md:size-14" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-ods-text-primary text-h3">
          <UnifiedSkeleton as="span" className="h-4 w-40" />
        </p>
        <p className="text-ods-text-secondary text-h6">
          <UnifiedSkeleton as="span" className="h-3 w-24" />
        </p>
      </div>
    </div>
  );
}

/** The section while the customers load: the real header and a full list of rows, the request's limit. */
export function CustomersOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading customers overview">
      <TitleBlock title="Customers Overview" />
      <div className="flex flex-col gap-[var(--spacing-system-mf)]">
        {CUSTOMER_ROW_KEYS.map(key => (
          <div key={key} data-loading-item className={CUSTOMER_ROW_CLASS}>
            <CustomerInfoCardSkeleton />
            <DashboardInfoCard
              loading
              value=""
              title="Online Devices"
              showProgress
              loadingShowsPercentage
              percentageDisplay="plain"
            />
            <DashboardInfoCard
              loading
              value=""
              title="Offline Devices"
              showProgress
              loadingShowsPercentage
              percentageDisplay="plain"
            />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

type CustomersOverviewData = ReturnType<typeof useCustomersOverview>;

/** The customers, read. */
export function CustomersOverviewSection() {
  return <CustomersOverview customers={useCustomersOverview(CUSTOMERS_OVERVIEW_LIMIT)} />;
}

/** The section over the customers it is handed; with none (or in a loading scope) it draws its own skeleton. */
export function CustomersOverview({ customers }: { customers?: CustomersOverviewData }) {
  // Initial load only (no rows yet): a refetch keeps the rows on screen.
  const loading = useLoadingScope() || !customers || (customers.loading && customers.rows.length === 0);
  if (loading) return <CustomersOverviewSkeleton />;

  const { rows, error, isOffline, canClaimEmpty, refresh } = customers;

  const organizationRows = (() => {
    if (error || isOffline) {
      // `LoadError`, not the inline `SectionLoadError`: this section has no
      // surviving cards to caption, so the error replaces its content. The raw
      // exception text is deliberately not shown — it reached here as
      // "Invalid organizations overview response structure".
      return <LoadError {...loadErrorProps(isOffline, "Couldn't load customers.", () => refresh())} />;
    }

    // `canClaimEmpty`, not a bare length check: offline the query PAUSES and
    // `rows` falls back to the empty constant, which this section reported as
    // "No Customers added yet" — a claim about the tenant made with no answer
    // from it. The two sibling sections gate on the same flag.
    if (canClaimEmpty && rows.length === 0) {
      return (
        <EmptyState
          icon={<IdCardIcon />}
          title="No Customers added yet"
          description="Add your first Customer to get started"
        />
      );
    }

    return rows.map(org => {
      const fullImageUrl = getFullImageUrl(org.imageUrl, org.imageHash);

      return (
        <div key={org.id} data-loading-item className={CUSTOMER_ROW_CLASS}>
          {/* Customer column — full row on mobile/tablet, half row on desktop.
              The `[&>div:first-child>span]` override enlarges the card's icon
              slot content so the customer logo fills the tile (Figma). */}
          <DashboardInfoCard
            className="col-span-2 [&>div:first-child>span]:size-full"
            icon={
              <EntityImage
                src={fullImageUrl}
                alt={org.name}
                className="size-full rounded-none border-0 content-md:size-full"
              />
            }
            titleSlot={
              <div className="flex min-w-0 items-baseline gap-[var(--spacing-system-xs)]">
                <div className="min-w-0">
                  <TruncateText variant="h3">{org.name}</TruncateText>
                </div>
                <span className="shrink-0 text-ods-text-secondary text-h4">({pluralize(org.total, 'device')})</span>
              </div>
            }
            value={org.websiteUrl || 'Organization'}
            valueClassName="text-ods-text-secondary text-h6 content-md:text-h6"
            href={routes.customers.details(org.organizationId)}
          />

          {/* Active devices */}
          <DashboardInfoCard
            title="Online Devices"
            value={org.active}
            percentage={org.activePct}
            showProgress
            progressVariant="success"
            percentageDisplay="plain"
            href={
              org.active > 0
                ? `/devices?organizationIds=${org.organizationId}&statuses=ONLINE`
                : `/devices?organizationIds=${org.organizationId}`
            }
          />

          {/* Inactive devices */}
          <DashboardInfoCard
            title="Offline Devices"
            value={org.inactive}
            percentage={org.inactivePct}
            showProgress
            progressVariant="error"
            percentageDisplay="plain"
            href={
              org.inactive > 0
                ? `/devices?organizationIds=${org.organizationId}&statuses=OFFLINE`
                : `/devices?organizationIds=${org.organizationId}`
            }
          />
        </div>
      );
    });
  })();

  return (
    <div>
      <TitleBlock title="Customers Overview" />

      <div className="flex flex-col gap-[var(--spacing-system-mf)]">{organizationRows}</div>
    </div>
  );
}

export default CustomersOverviewSection;
