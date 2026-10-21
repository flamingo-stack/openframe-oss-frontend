'use client';

import { DashboardInfoCard, EntityImage, TitleBlock, TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { DEVICE_STATUS } from '@flamingo-stack/openframe-frontend-core/components/features';
import { IdCardIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError, LoadingItems, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EmptyState } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { pluralize } from '@/lib/pluralize';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useCustomersOverview } from '../hooks/use-customers-overview';
import { DeviceStatusInfoCard } from './devices-overview';

/** How many customers the section lists: the hook's limit, so the skeleton draws the same count. */
const CUSTOMERS_OVERVIEW_LIMIT = 10;

/** One row's grid: the customer card (full row on mobile/tablet, half from `lg`) then its two device cards. */
const CUSTOMER_ROW_CLASS = 'grid grid-cols-2 items-stretch gap-[var(--spacing-system-mf)] content-lg:grid-cols-4';

/** The customer card's value line (its website) and its icon slot override (the logo fills the tile, Figma). */
const CUSTOMER_CARD_CLASS = 'col-span-2 [&>div:first-child>span]:size-full';
const CUSTOMER_VALUE_CLASS = 'text-ods-text-secondary text-h6 content-md:text-h6';

/** The two device statuses a row counts, in order (titles and colours from the devices overview's one definition). */
const ROW_DEVICE_STATUSES = [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE] as const;

type CustomerRow = CustomersOverviewData['rows'][number];

/** A row's device cards over the customer it is handed; `null` while the customers are read (the cards' figures are bars). */
function DeviceCards({ org }: { org: CustomerRow | null }) {
  return ROW_DEVICE_STATUSES.map(status => {
    const online = status === DEVICE_STATUS.ONLINE;
    const count = org ? (online ? org.active : org.inactive) : 0;
    return (
      <DeviceStatusInfoCard
        key={status}
        status={status}
        loading={!org}
        value={count}
        percentage={org ? (online ? org.activePct : org.inactivePct) : undefined}
        href={
          org
            ? count > 0
              ? `/devices?organizationIds=${org.organizationId}&statuses=${status}`
              : `/devices?organizationIds=${org.organizationId}`
            : undefined
        }
      />
    );
  });
}

/**
 * One customer's row, loaded or loading (`org` null): the customer card, then its two device cards. While loading the
 * customer's logo, name and device count are read, so its icon and title line are bars.
 */
function CustomerOverviewRow({ org }: { org: CustomerRow | null }) {
  return (
    <div data-loading-item className={CUSTOMER_ROW_CLASS}>
      {/* Customer column — full row on mobile/tablet, half row on desktop.
          The `[&>div:first-child>span]` override enlarges the card's icon
          slot content so the customer logo fills the tile (Figma). */}
      <DashboardInfoCard
        loading={!org}
        iconLoading
        className={CUSTOMER_CARD_CLASS}
        icon={
          org && (
            <EntityImage
              src={getFullImageUrl(org.imageUrl, org.imageHash)}
              alt={org.name}
              className="size-full rounded-none border-0 content-md:size-full"
            />
          )
        }
        titleSlot={
          <div className="flex min-w-0 items-baseline gap-[var(--spacing-system-xs)]">
            {org ? (
              <>
                <div className="min-w-0">
                  <TruncateText variant="h3">{org.name}</TruncateText>
                </div>
                <span className="shrink-0 text-ods-text-secondary text-h4">({pluralize(org.total, 'device')})</span>
              </>
            ) : (
              <>
                <TextLineSkeleton type="h3" className="w-40 min-w-0" />
                <TextLineSkeleton type="h4" className="w-20 shrink-0" />
              </>
            )}
          </div>
        }
        value={org ? org.websiteUrl || 'Organization' : ''}
        valueClassName={CUSTOMER_VALUE_CLASS}
        href={org ? routes.customers.details(org.organizationId) : undefined}
      />
      <DeviceCards org={org} />
    </div>
  );
}

type CustomersOverviewData = ReturnType<typeof useCustomersOverview>;

/** The customers, read. */
export function CustomersOverviewSection() {
  return <CustomersOverview customers={useCustomersOverview(CUSTOMERS_OVERVIEW_LIMIT)} />;
}

/** The section over the customers it is handed; with none (or in a loading scope) its rows draw their loading state. */
export function CustomersOverview({ customers }: { customers?: CustomersOverviewData }) {
  // Initial load only (no rows yet): a refetch keeps the rows on screen.
  const loading = useLoadingScope() || !customers || (customers.loading && customers.rows.length === 0);

  const organizationRows = (() => {
    if (loading || !customers) {
      return (
        <LoadingRegion label="Loading customers overview" className="contents">
          <LoadingItems count={CUSTOMERS_OVERVIEW_LIMIT}>{() => <CustomerOverviewRow org={null} />}</LoadingItems>
        </LoadingRegion>
      );
    }
    const { rows, error, isOffline, canClaimEmpty, refresh } = customers;

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

    return rows.map(org => <CustomerOverviewRow key={org.id} org={org} />);
  })();

  return (
    <div>
      <TitleBlock title="Customers Overview" />

      <div className="flex flex-col gap-[var(--spacing-system-mf)]">{organizationRows}</div>
    </div>
  );
}
