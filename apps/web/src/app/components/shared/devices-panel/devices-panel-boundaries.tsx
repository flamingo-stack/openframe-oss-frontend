'use client';

import {
  buildDevicePanelActions,
  type DevicePanelActionsOptions,
  DevicesPanelView,
  getDeviceActionsColumn,
  getDeviceFilterColumns,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { routes } from '@/lib/routes';

const NO_DEVICES: Device[] = [];
/** The loaded table's actions column, minus the actions: see `getDeviceActionsColumn`. */
const SKELETON_ACTIONS_COLUMN = getDeviceActionsColumn<Device>();
/**
 * The grid's filter row while the facets are out. `getDeviceFilterColumns`
 * takes the facets, and with none it still yields every column with its static
 * label, which is all the row needs to hold its height.
 */
const SKELETON_FILTER_COLUMNS = getDeviceFilterColumns(null);

export interface DevicesPanelChrome {
  title: string;
  backButton?: { label?: string; onClick: () => void };
  className?: string;
  offsetClassName?: string;
}

export interface DevicesPanelSkeletonProps extends DevicesPanelChrome, DevicePanelActionsOptions {
  /**
   * Which half the loaded panel will render, straight from the `viewMode` URL
   * param. Table and grid are different SHAPES (a header row over full-width
   * rows versus a card grid), so a fallback that always drew the table replaced
   * itself wholesale whenever the user's saved view was the grid.
   */
  viewMode: 'table' | 'grid';
  /** Forwarded so the placeholder table has the loaded table's column set. */
  hideColumns?: string[];
  /** Forwarded so the same column headers lose their funnel as in the loaded table. */
  hideFilters?: string[];
}

/**
 * Suspense fallback for `DevicesPanel`.
 *
 * The panel's own view in its `loading` state: a loading state made of the REAL
 * controls cannot drift from the thing it stands in for, because it IS that
 * thing with its data missing.
 *
 * Everything here is a prop or a URL value, none of it the device query: the
 * header buttons come from the one declaration the loaded panel also reads
 * (`buildDevicePanelActions`), the view switch reflects `?viewMode`, and the
 * filter toolbar is the actual toolbar with empty tags. What is skeletoned is
 * only what the request answers: the rows.
 */
export function DevicesPanelSkeleton({
  title,
  backButton,
  className,
  offsetClassName,
  viewMode,
  hideColumns,
  hideFilters,
  ...actionOptions
}: DevicesPanelSkeletonProps) {
  return (
    <DevicesPanelView<Device>
      loading
      title={title}
      backButton={backButton}
      className={cn(offsetClassName, className)}
      viewMode={viewMode}
      actions={buildDevicePanelActions({
        ...actionOptions,
        addCustomerHref: routes.customers.new,
        disabled: true,
      })}
      devices={NO_DEVICES}
      filterColumns={SKELETON_FILTER_COLUMNS}
      // The loaded table always carries a row-actions column, and it takes real
      // width from the others. Rendering the header without it put every column
      // at the wrong width.
      actionsColumn={SKELETON_ACTIONS_COLUMN}
      hideColumns={hideColumns}
      hideFilters={hideFilters}
    />
  );
}
