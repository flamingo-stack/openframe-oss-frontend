import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Software Actions list, shared by the live table and its
 * skeleton — see `table-column-layout.ts` for why this module is data-only.
 */
const SOFTWARE_ACTION_COLUMNS = {
  software: { id: 'software', header: 'Software', width: 'flex-1 min-w-0' },
  // The three funnels the design puts on this list, fed by `softwareActionFilters`.
  action: { id: 'action', header: 'Action', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  engine: { id: 'engine', header: 'Engine', width: 'flex-1 min-w-0', hideAt: 'lg', filterable: true },
  status: { id: 'status', header: 'Status', width: 'flex-1 min-w-0', filterable: true },
  processedDevices: { id: 'processedDevices', header: 'Processed Devices', width: 'w-[120px] md:w-[184px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_ACTION_COLUMNS };

/** `/software/actions` — render order for the live table and its skeleton. */
export const SOFTWARE_ACTION_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_ACTION_COLUMNS.software,
  SOFTWARE_ACTION_COLUMNS.action,
  SOFTWARE_ACTION_COLUMNS.engine,
  SOFTWARE_ACTION_COLUMNS.status,
  SOFTWARE_ACTION_COLUMNS.processedDevices,
  SOFTWARE_ACTION_COLUMNS.open,
];

export const SOFTWARE_ACTIONS_PAGE_SIZE = 20;
