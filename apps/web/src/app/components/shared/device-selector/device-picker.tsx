'use client';

import {
  type DeviceRow,
  DeviceSelector,
  type DeviceSelectorProps,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useGridTableProps } from '@/app/hooks/use-table-layout';

/**
 * The saved-layout key of every device picker in the app, in one place so no two pickers share a layout by accident.
 * The schedule's criteria preview has a key of its own: it draws the same devices without the add / remove column.
 */
export const DEVICE_PICKER_TABLE_KEY = {
  policy: 'policy-device-picker',
  query: 'query-device-picker',
  onboardingPolicy: 'onboarding-policy-device-picker',
  schedule: 'schedule-device-picker',
  scheduleCriteria: 'schedule-criteria-devices',
  softwareBundle: 'software-bundle-device-picker',
  softwareAdopt: 'software-adopt-device-picker',
  runScript: 'run-script-device-picker',
  testScript: 'test-script-device-picker',
} as const;

export type DevicePickerTableKey = (typeof DEVICE_PICKER_TABLE_KEY)[keyof typeof DEVICE_PICKER_TABLE_KEY];

export type DevicePickerProps<T extends DeviceRow = DeviceRow> = Omit<
  DeviceSelectorProps<T>,
  'layout' | 'tableMaxHeight' | 'tableSettings'
> & {
  /**
   * The key the viewer's column layout of this picker's table is kept under in the browser
   * (`DEVICE_PICKER_TABLE_KEY`). One per host: two pickers with one key share a layout.
   */
  tableStorageKey: DevicePickerTableKey;
};

/**
 * The lib's device picker (`DeviceSelector`) in the layout the app's table flag gives (`data-table-grid`): the grid
 * table with the flag on, card rows with it off. Every picker in the app is rendered through this, its loading forms
 * included, so a host's loading state and its loaded picker cannot draw two layouts.
 *
 * It reads the flag itself: the read is the flags store's, with no request of its own, so it is safe in a loading
 * scope and in a Suspense fallback. Until the flag has answered the picker draws in a loading scope, so it never
 * draws one layout and swaps to the other.
 *
 * No height of its own: a picker is one section of a form, so the page (or the modal) scrolls, not the table.
 */
export function DevicePicker<T extends DeviceRow = DeviceRow>({ tableStorageKey, ...props }: DevicePickerProps<T>) {
  const grid = useGridTableProps(tableStorageKey);
  return (
    <LoadingWhen loading={grid.loading}>
      <DeviceSelector<T> {...props} layout={grid.layout} tableSettings={grid.settings} />
    </LoadingWhen>
  );
}
