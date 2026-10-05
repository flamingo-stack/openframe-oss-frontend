'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DeviceIncidentsTable } from '@/app/(app)/incidents/components/incidents-table';
import { ContentErrorBoundary } from '@/app/components/shared';
import type { Device } from '../../types/device.types';
import { TabEmptyState } from './tab-empty-state';

interface IncidentsTabProps {
  device: Device | null;
}

const NO_INCIDENTS = (
  <TabEmptyState
    icon={<AlertTriangleIcon />}
    title="No incidents detected"
    description="Incidents detected on this device will appear here."
  />
);

/**
 * Device → Incidents: the Incidents page's list narrowed server-side to this
 * machine (`InsightFilter.machineIds`). Visibility is decided in `useDeviceTabs`.
 */
export function IncidentsTab({ device }: IncidentsTabProps) {
  // Incidents key on the agent's machine id; without one there is nothing to ask for.
  if (!device?.machineId) {
    return NO_INCIDENTS;
  }

  return (
    <ContentErrorBoundary label="IncidentsTab" message="Couldn't load this device's incidents.">
      <DeviceIncidentsTable machineId={device.machineId} emptyState={NO_INCIDENTS} />
    </ContentErrorBoundary>
  );
}
