import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for Software → Devices, read by the live table — see `table-column-layout.ts` for why this module is
 * data-only (no imports, no JSX).
 */
const SOFTWARE_DEVICE_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-1 min-w-0' },
  // Carries BOTH controls the design puts on this tab: the sort toggle (the
  // version) and the per-device status funnel (the chip beside it).
  softwareVersion: {
    id: 'softwareVersion',
    header: 'Software Version',
    // On a phone the cell is the chip alone, at its own width, so the device keeps the row (1239:20463).
    width: 'flex-none content-md:flex-1 content-md:min-w-0',
    sortable: true,
  },
  // "Installed By" in the later frames (1562:59149, 1239:125); 1100:444 still says Managed By.
  installedBy: { id: 'installedBy', header: 'Installed By', width: 'flex-1 min-w-0', hideAt: 'md' },
  autoUpdate: { id: 'autoUpdate', header: 'Auto-update', width: 'w-[120px]', hideAt: 'lg' },
  // On a phone too (1239:20463): the row's way to the device.
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_DEVICE_COLUMNS };

/**
 * The only value allowed to reach `SortInput.field` on this list — anything else
 * in the URL falls back to the backend's own order. Matches the column id of the
 * one sortable header.
 */
export const SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS: readonly string[] = [SOFTWARE_DEVICE_COLUMNS.softwareVersion.id];

export const SOFTWARE_DEVICES_PAGE_SIZE = 20;
