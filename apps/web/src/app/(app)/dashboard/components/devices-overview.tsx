'use client';

import { DashboardInfoCard, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { DEVICE_STATUS } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SectionLoadError } from '@/app/components/shared';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useDevicesOverview } from '../hooks/use-dashboard-stats';

type ProgressVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * Each device status's card title and progress colour: the one definition the devices overview and the customers
 * overview's per-customer cards read.
 */
const DEVICE_STATUS_CARD = {
  [DEVICE_STATUS.ONLINE]: { title: 'Online Devices', progressVariant: 'success' },
  [DEVICE_STATUS.OFFLINE]: { title: 'Offline Devices', progressVariant: 'error' },
  [DEVICE_STATUS.PENDING]: { title: 'Pending Devices', progressVariant: 'warning' },
  [DEVICE_STATUS.ARCHIVED]: { title: 'Archived Devices', progressVariant: 'info' },
} as const satisfies Record<string, { title: string; progressVariant: ProgressVariant }>;

type DeviceStatus = keyof typeof DEVICE_STATUS_CARD;

/**
 * One device status's card (the devices overview's four, the customers overview's two per customer): its title and
 * progress colour from {@link DEVICE_STATUS_CARD}, the figure and its share. While `loading` (or in a loading scope)
 * the figure and the share are bars in the loaded card's box.
 */
export function DeviceStatusInfoCard({
  status,
  value,
  percentage,
  loading,
  href,
  showProgress = true,
  progressSize,
}: {
  status: DeviceStatus;
  value: string | number;
  percentage?: number;
  loading?: boolean;
  href?: string;
  showProgress?: boolean;
  progressSize?: { base: number; md: number };
}) {
  return (
    <DashboardInfoCard
      loading={loading}
      title={DEVICE_STATUS_CARD[status].title}
      value={value}
      percentage={percentage}
      showProgress={showProgress}
      loadingShowsPercentage
      progressVariant={DEVICE_STATUS_CARD[status].progressVariant}
      percentageDisplay="plain"
      progressSize={progressSize}
      href={href}
    />
  );
}

type DeviceStatusCard = {
  status: DeviceStatus;
  /** `null` = the stats request failed; render unavailable, not zero. */
  value: number | null;
  percentage: number | null;
};

type DevicesOverviewData = ReturnType<typeof useDevicesOverview>;

/** The device counts, read. */
export function DevicesOverviewSection() {
  return <DevicesOverview devices={useDevicesOverview()} />;
}

/** The section over the counts it is handed; with none (or in a loading scope) the cards draw their figures as bars. */
export function DevicesOverview({ devices }: { devices?: DevicesOverviewData }) {
  const loading = useLoadingScope() || !devices || devices.isLoading;
  const counts = loading ? undefined : devices;

  // The four cards, in order: their static titles always, their figures once read.
  const statusCards: DeviceStatusCard[] = [
    {
      status: DEVICE_STATUS.ONLINE,
      value: counts?.active ?? null,
      percentage: counts?.activePercentage ?? null,
    },
    {
      status: DEVICE_STATUS.OFFLINE,
      value: counts?.inactive ?? null,
      percentage: counts?.inactivePercentage ?? null,
    },
    {
      status: DEVICE_STATUS.PENDING,
      value: counts?.pending ?? null,
      percentage: counts?.pendingPercentage ?? null,
    },
    {
      status: DEVICE_STATUS.ARCHIVED,
      value: counts?.archived ?? null,
      percentage: counts?.archivedPercentage ?? null,
    },
  ];

  return (
    <LoadingRegion label="Loading devices overview" announce={loading}>
      <TitleBlock title="Devices Overview" />

      {counts && (counts.error || counts.isOffline) && (
        <SectionLoadError
          {...loadErrorProps(counts.isOffline, "Couldn't load device counts.", () => counts.refetch())}
        />
      )}

      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)] content-lg:grid-cols-4">
        {statusCards.map(card => (
          <DeviceStatusInfoCard
            key={card.status}
            status={card.status}
            loading={loading}
            // `—` rather than a number: the request failed, so any digit here
            // would be invented. See the null contract in `use-dashboard-stats`.
            value={loading ? '' : (card.value ?? EMPTY_VALUE)}
            percentage={card.percentage ?? undefined}
            showProgress={loading || card.percentage != null}
            progressSize={{ base: 24, md: 56 }}
            href={
              // Archived devices live on their own page; /devices only lists the rest.
              card.status === DEVICE_STATUS.ARCHIVED
                ? routes.devices.archive
                : routes.devices.filtered({ statuses: [card.status] })
            }
          />
        ))}
      </div>
    </LoadingRegion>
  );
}
