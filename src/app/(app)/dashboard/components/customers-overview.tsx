'use client';

import { DashboardInfoCard, EntityImage, TitleBlock, TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { IdCardIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { EmptyState } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useCustomersOverview } from '../hooks/use-customers-overview';
import { CustomersOverviewSkeleton } from './dashboard-skeletons';

/**
 * Organizations Overview Section
 */
export function CustomersOverviewSection() {
  const { rows, loading, error, isOffline, canClaimEmpty, refresh } = useCustomersOverview(10);

  const organizationRows = useMemo(() => {
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
        <div key={org.id} className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--spacing-system-mf)] items-stretch">
          {/* Customer column — full row on mobile/tablet, half row on desktop.
              The `[&>div:first-child>span]` override enlarges the card's icon
              slot content so the customer logo fills the tile (Figma). */}
          <DashboardInfoCard
            className="col-span-2 [&>div:first-child>span]:size-full"
            icon={
              <EntityImage src={fullImageUrl} alt={org.name} className="size-full md:size-full rounded-none border-0" />
            }
            titleSlot={
              <div className="flex min-w-0 items-baseline gap-[var(--spacing-system-xs)]">
                <div className="min-w-0">
                  <TruncateText variant="h3">{org.name}</TruncateText>
                </div>
                <span className="shrink-0 text-h4 text-ods-text-secondary">({org.total.toLocaleString()} devices)</span>
              </div>
            }
            value={org.websiteUrl || 'Organization'}
            valueClassName="text-h6 md:text-h6 text-ods-text-secondary"
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
                ? routes.devices.list({ organizationIds: [org.organizationId], statuses: ['ONLINE'] })
                : routes.devices.list({ organizationIds: [org.organizationId] })
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
                ? routes.devices.list({ organizationIds: [org.organizationId], statuses: ['OFFLINE'] })
                : routes.devices.list({ organizationIds: [org.organizationId] })
            }
          />
        </div>
      );
    });
  }, [rows, error, isOffline, canClaimEmpty, refresh]);

  // Initial load (no rows yet) — render the full skeleton so the header (with its
  // subtitle line) matches the loaded layout and doesn't jump when data arrives.
  if (loading && rows.length === 0) {
    return <CustomersOverviewSkeleton />;
  }

  return (
    <div>
      <TitleBlock title="Customers Overview" />

      <div className="flex flex-col gap-[var(--spacing-system-mf)]">{organizationRows}</div>
    </div>
  );
}

export default CustomersOverviewSection;
