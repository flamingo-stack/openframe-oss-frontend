'use client';

import type { DeviceFilters } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ReactNode } from 'react';
import { type ScheduleDeviceHalf, useScheduleDeviceFilters } from '../hooks/use-schedule-device-filters';

/**
 * A schedule's facet read as a component of its own, so that an error boundary can sit around it alone (see
 * `DeviceFacets`). The boundary's fallback draws the same list with `EMPTY_DEVICE_FILTERS`: a failed facet read, the
 * schedule's own or the fleet tags it borrows, then costs the funnels instead of the rows.
 */
export function ScheduleDeviceFacets({
  scheduleId,
  half,
  prefetchOtherHalf,
  children,
}: {
  scheduleId: string;
  half: ScheduleDeviceHalf;
  prefetchOtherHalf?: boolean;
  children: (deviceFilters: DeviceFilters) => ReactNode;
}) {
  const deviceFilters = useScheduleDeviceFilters(scheduleId, half, { prefetchOtherHalf });
  return children(deviceFilters);
}
