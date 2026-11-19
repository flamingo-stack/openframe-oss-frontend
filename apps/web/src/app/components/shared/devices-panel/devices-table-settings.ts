import type { DataTableSettings } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { TableLayout } from '@/app/hooks/use-table-layout';

/**
 * The Devices page's grid table settings: the gear's menu of columns, with the viewer's layout (hidden columns, their
 * order, resized widths) kept in the browser. One key for both panels: they draw the same page.
 */
export const DEVICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'devices' };

/**
 * The Devices archive's settings, under its own key: it draws other columns than the Devices page (no USER or
 * SOURCES, no customer when opened from one customer), so one saved layout would not fit both.
 */
export const DEVICES_ARCHIVE_TABLE_SETTINGS: DataTableSettings = { storageKey: 'devices-archive' };

/** A customer's Devices tab, under its own key: its table has no customer column. */
export const CUSTOMER_DEVICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'customer-devices' };

/** The devices assigned to an item (the assignments panel), under their own key. */
export const ASSIGNED_DEVICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'assigned-devices' };

/**
 * What a devices panel's table takes for its layout, in the loaded panel and in its loading form alike (they are the
 * same table: a loading table of another height or under another key would jump when the rows arrive).
 *
 * The grid table is the page's scroll area (`fill`: it takes the height under the toolbar) where the panel IS the
 * page. Embedded in a tab of a longer page it keeps its natural height and the page scrolls. The card rows take
 * neither option.
 */
export function devicesTableGridProps({
  tableLayout,
  embedded,
  tableSettings,
}: {
  tableLayout?: TableLayout;
  embedded?: boolean;
  tableSettings?: DataTableSettings;
}): { tableMaxHeight: 'fill' | undefined; tableSettings: DataTableSettings | undefined } {
  if (tableLayout !== 'grid') return { tableMaxHeight: undefined, tableSettings: undefined };
  return { tableMaxHeight: embedded ? undefined : 'fill', tableSettings: tableSettings ?? DEVICES_TABLE_SETTINGS };
}
