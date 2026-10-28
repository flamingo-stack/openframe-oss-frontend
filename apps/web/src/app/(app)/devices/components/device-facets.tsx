'use client';

import type { DeviceFilterInput, DeviceFilters } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ReactNode } from 'react';
import { useDeviceFilters } from '../hooks/use-device-filters';

/**
 * The fleet facet read as a component of its own, so that an error boundary can sit around it alone.
 *
 * Facets narrow a list; they are not the list. Render this under a `ContentErrorBoundary` whose fallback draws the
 * same `children` with no facets, and a failed facet query costs the filters instead of the rows (see `DevicesPanel`).
 */
export function DeviceFacets({
  filters,
  children,
}: {
  filters?: DeviceFilterInput;
  children: (deviceFilters: DeviceFilters) => ReactNode;
}) {
  const deviceFilters = useDeviceFilters(filters);
  return children(deviceFilters);
}
