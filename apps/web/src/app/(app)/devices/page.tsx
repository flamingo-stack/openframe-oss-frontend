'use client';

import {
  ActivityIcon,
  BracketCurlyIcon,
  MonitorIcon,
  TerminalIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DevicesPanel, EmptyState, onboardingGuideButton } from '@/app/components/shared';
import { tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { routes } from '@/lib/routes';
import { DevicesTabNavigation } from './components/devices-tab-navigation';
import { useHasOrganizations } from './hooks/use-has-organizations';

export default function Devices() {
  const { hasOrganizations, isLoading } = useHasOrganizations();
  const guideButton = onboardingGuideButton('devices');
  // The new grid table, behind the app's one table flag; card rows while it is off.
  const tableGate = useTableGridGate();

  return (
    <div className="flex w-full flex-col">
      {/* Devices List | Remote Sessions, where session recordings are on. */}
      <DevicesTabNavigation activeTab="list" />
      <LoadingWhen loading={tableGate === 'loading'}>
        <DevicesPanel
          className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
          tableLayout={tableLayoutFor(tableGate)}
          archiveHref={routes.devices.archive()}
          // Only treat the tenant as having no customers once the check resolves, so the
          // "Add a customer" banner doesn't flash during loading. While checking, the
          // panel still keeps "Add Device" disabled via isCheckingOrganizations.
          noOrganizations={hasOrganizations === false}
          isCheckingOrganizations={isLoading}
          emptyState={
            <EmptyState
              icon={<MonitorIcon />}
              title="No devices connected"
              description="Devices (laptops, servers, workstations, mobile) you monitor and manage across all client Customers will be displayed here."
              actions={[
                { icon: <ActivityIcon />, label: 'Monitor health, CPU, memory, and disk usage in real time' },
                { icon: <BracketCurlyIcon />, label: 'Run scripts, policies, and queries across one or many devices' },
                { icon: <TerminalIcon />, label: 'Launch remote sessions and view full software inventory' },
              ]}
              {...guideButton}
            />
          }
        />
      </LoadingWhen>
    </div>
  );
}
