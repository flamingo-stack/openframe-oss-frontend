import type { DataTableSettings } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The Devices page's grid table settings: the gear's menu of columns, with the viewer's layout (hidden columns, their
 * order, resized widths) kept in the browser. One key for both panels: they draw the same page.
 */
export const DEVICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'devices' };
