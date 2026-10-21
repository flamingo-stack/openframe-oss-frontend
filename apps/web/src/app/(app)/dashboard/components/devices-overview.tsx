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

const DEVICE_CARDS = ['Online Devices', 'Offline Devices', 'Pending Devices', 'Archived Devices'] as const;

/** The section while the counts load: the real header and the four cards with their real titles. */
export function DevicesOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading devices overview">
      <TitleBlock title="Devices Overview" />
      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)] content-lg:grid-cols-4">
        {DEVICE_CARDS.map(title => (
          <DashboardInfoCard
            key={title}
            loading
            value=""
            title={title}
            showProgress
            loadingShowsPercentage
            percentageDisplay="plain"
          />
        ))}
      </div>
    </LoadingRegion>
  );
}

/** The device counts, read. */
export function DevicesOverviewSection() {
  return <DevicesOverview devices={useDevicesOverview()} />;
}

/** The section over the counts it is handed; with none (or in a loading scope) it draws its own skeleton. */
export function DevicesOverview({ devices }: { devices?: DevicesOverviewData }) {
  const loading = useLoadingScope() || !devices || devices.isLoading;
  if (loading) return <DevicesOverviewSkeleton />;

  const statusCards: DeviceStatusCard[] = [
    {
      status: DEVICE_STATUS.ONLINE,
      title: 'Online Devices',
      value: devices.active,
      percentage: devices.activePercentage,
      progressVariant: 'success',
    },
    {
      status: DEVICE_STATUS.OFFLINE,
      title: 'Offline Devices',
      value: devices.inactive,
      percentage: devices.inactivePercentage,
      progressVariant: 'error',
    },
    {
      status: DEVICE_STATUS.PENDING,
      title: 'Pending Devices',
      value: devices.pending,
      percentage: devices.pendingPercentage,
      progressVariant: 'warning',
    },
    {
      status: DEVICE_STATUS.ARCHIVED,
      title: 'Archived Devices',
      value: devices.archived,
      percentage: devices.archivedPercentage,
      progressVariant: 'info',
    },
  ];

  return (
    <div>
      <TitleBlock title="Devices Overview" />

      {(devices.error || devices.isOffline) && (
        <SectionLoadError
          {...loadErrorProps(devices.isOffline, "Couldn't load device counts.", () => devices.refetch())}
        />
      )}

      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)] content-lg:grid-cols-4">
        {statusCards.map(card => (
          <DashboardInfoCard
            key={card.status}
            title={card.title}
            // `—` rather than a number: the request failed, so any digit here
            // would be invented. See the null contract in `use-dashboard-stats`.
            value={card.value ?? EMPTY_VALUE}
            percentage={card.percentage ?? undefined}
            showProgress={card.percentage != null}
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
    </div>
  );
}

export default DevicesOverviewSection;
