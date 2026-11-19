import type { DataTableSettings } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The grid table settings of the monitoring tables: the gear's menu of columns, with the viewer's layout (hidden
 * columns, their order, resized widths) kept in the browser. One key per table: two tables with one key share a layout.
 */

/** Monitoring → Policies. */
export const POLICIES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'monitoring-policies' };
/** Monitoring → Queries. */
export const QUERIES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'monitoring-queries' };
/** A policy's page → Devices. */
export const POLICY_DEVICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'monitoring-policy-devices' };
/** A query's page → Assigned Devices. */
export const QUERY_DEVICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'monitoring-query-devices' };
/** A device's page → Policies: the same columns as the fleet-wide list, a layout of its own. */
export const DEVICE_POLICIES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'device-policies' };
/** A device's page → Queries: the same columns as the fleet-wide list, a layout of its own. */
export const DEVICE_QUERIES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'device-queries' };
