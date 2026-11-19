import type { DataTableSettings } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The logs grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order,
 * resized widths) kept in the browser. A key per place the table is drawn: each has its own columns (a device's logs
 * have no device to name, a customer's no customer to filter by) and its own width to fit.
 */
const LOGS_TABLE_SETTINGS = {
  page: { storageKey: 'logs' },
  device: { storageKey: 'logs-device' },
  customer: { storageKey: 'logs-customer' },
} satisfies Record<string, DataTableSettings>;

/** Where a logs table is drawn: the Logs page, a device's Overview tab, a customer's Logs tab. */
export type LogsTablePlace = keyof typeof LOGS_TABLE_SETTINGS;

export function logsTablePlace({
  deviceScoped,
  organizationLocked,
}: {
  deviceScoped: boolean;
  organizationLocked: boolean;
}): LogsTablePlace {
  if (deviceScoped) return 'device';
  return organizationLocked ? 'customer' : 'page';
}

export function logsTableSettings(place: LogsTablePlace): DataTableSettings {
  return LOGS_TABLE_SETTINGS[place];
}
