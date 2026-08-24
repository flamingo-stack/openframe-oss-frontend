'use client';

import { DashboardInfoCard, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { SectionLoadError } from '@/app/components/shared';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { DEVICE_STATUS } from '../../devices/constants/device-statuses';
import { useDevicesOverview } from '../hooks/use-dashboard-stats';
import { DevicesOverviewSkeleton } from './dashboard-skeletons';

type DeviceStatusCard = {
  status: string;
  title: string;
  /** `null` = the stats request failed; render unavailable, not zero. */
  value: number | null;
  percentage: number | null;
  progressVariant: 'success' | 'error' | 'warning' | 'info';
};

export function DevicesOverviewSection() {
  const devices = useDevicesOverview();

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

  if (devices.isLoading) {
    return <DevicesOverviewSkeleton />;
  }

  return (
    <div>
      <TitleBlock title="Devices Overview" />

      {(devices.error || devices.isOffline) && (
        <SectionLoadError
          {...loadErrorProps(devices.isOffline, "Couldn't load device counts.", () => devices.refetch())}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--spacing-system-mf)]">
        {statusCards.map(card => (
          <DashboardInfoCard
            key={card.status}
            title={card.title}
            // `—` rather than a number: the request failed, so any digit here
            // would be invented. See the null contract in `use-dashboard-stats`.
            value={card.value ?? '—'}
            percentage={card.percentage ?? undefined}
            showProgress={card.percentage != null}
            progressVariant={card.progressVariant}
            percentageDisplay="plain"
            progressSize={{ base: 24, md: 56 }}
            href={
              // Archived devices live on their own page; /devices only lists the rest.
              card.status === DEVICE_STATUS.ARCHIVED
                ? routes.devices.archive
                : routes.devices.byStatus(card.status)
            }
          />
        ))}
      </div>
    </div>
  );
}

export default DevicesOverviewSection;
