import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Software Actions list, read by the live table — see `table-column-layout.ts` for why this module is data-only.
 */
const SOFTWARE_ACTION_COLUMNS = {
  software: { id: 'software', header: 'Software', width: 'flex-1 min-w-0' },
  // The three funnels the design puts on this list, fed by `softwareActionFilters`.
  action: { id: 'action', header: 'Action', width: 'flex-1 min-w-0', hideAt: 'md' },
  engine: { id: 'engine', header: 'Engine', width: 'flex-1 min-w-0', hideAt: 'lg' },
  // Below md the tag keeps its whole width beside the open button (mobile frame 1049:16193).
  status: { id: 'status', header: 'Status', width: 'flex-none content-md:flex-1 content-md:min-w-0' },
  processedDevices: { id: 'processedDevices', header: 'Processed Devices', width: 'w-[184px]', hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_ACTION_COLUMNS };

export const SOFTWARE_ACTIONS_PAGE_SIZE = 20;
