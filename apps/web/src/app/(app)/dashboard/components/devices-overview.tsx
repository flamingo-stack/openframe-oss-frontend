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

type DeviceStatusCard = {
  status: string;
  title: string;
  /** `null` = the stats request failed; render unavailable, not zero. */
  value: number | null;
  percentage: number | null;
  progressVariant: 'success' | 'error' | 'warning' | 'info';
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
      title: 'Online Devices',
      value: counts?.active ?? null,
      percentage: counts?.activePercentage ?? null,
      progressVariant: 'success',
    },
    {
      status: DEVICE_STATUS.OFFLINE,
      title: 'Offline Devices',
      value: counts?.inactive ?? null,
      percentage: counts?.inactivePercentage ?? null,
      progressVariant: 'error',
    },
    {
      status: DEVICE_STATUS.PENDING,
      title: 'Pending Devices',
      value: counts?.pending ?? null,
      percentage: counts?.pendingPercentage ?? null,
      progressVariant: 'warning',
    },
    {
      status: DEVICE_STATUS.ARCHIVED,
      title: 'Archived Devices',
      value: counts?.archived ?? null,
      percentage: counts?.archivedPercentage ?? null,
      progressVariant: 'info',
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
          <DashboardInfoCard
            key={card.status}
            loading={loading}
            title={card.title}
            // `—` rather than a number: the request failed, so any digit here
            // would be invented. See the null contract in `use-dashboard-stats`.
            value={loading ? '' : (card.value ?? EMPTY_VALUE)}
            percentage={card.percentage ?? undefined}
            showProgress={loading || card.percentage != null}
            loadingShowsPercentage
            progressVariant={card.progressVariant}
            percentageDisplay="plain"
            progressSize={{ base: 24, md: 56 }}
            href={
              // Archived devices live on their own page; /devices only lists the rest.
              card.status === DEVICE_STATUS.ARCHIVED ? routes.devices.archive : `/devices?statuses=${card.status}`
            }
          />
        ))}
      </div>
    </LoadingRegion>
  );
}

export default DevicesOverviewSection;
