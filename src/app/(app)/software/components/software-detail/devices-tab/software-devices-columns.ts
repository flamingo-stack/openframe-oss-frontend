import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for Software → Devices, shared by the live table and its
 * `<Suspense>` skeleton — see `table-column-layout.ts` for why this module is
 * data-only (no imports, no JSX).
 */
const SOFTWARE_DEVICE_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-1 min-w-0' },
  // Carries BOTH controls the design puts on this tab: the sort toggle (the
  // version) and the per-device status funnel (the chip beside it).
  softwareVersion: {
    id: 'softwareVersion',
    header: 'Software Version',
    width: 'flex-1 min-w-0',
    sortable: true,
    filterable: true,
  },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_DEVICE_COLUMNS };

/** Render order for the live table and its skeleton. */
export const SOFTWARE_DEVICES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_DEVICE_COLUMNS.device,
  SOFTWARE_DEVICE_COLUMNS.softwareVersion,
  SOFTWARE_DEVICE_COLUMNS.open,
];

/**
 * The only value allowed to reach `SortInput.field` on this list — anything else
 * in the URL falls back to the backend's own order. Matches the column id of the
 * one sortable header.
 */
export const SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS: readonly string[] = [SOFTWARE_DEVICE_COLUMNS.softwareVersion.id];

export const SOFTWARE_DEVICES_PAGE_SIZE = 20;
