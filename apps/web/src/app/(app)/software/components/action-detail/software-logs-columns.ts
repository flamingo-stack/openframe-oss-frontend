import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for Software Update Details' per-device logs, read by the
 * live table — see `table-column-layout.ts` for why this
 * module is data-only.
 */
const SOFTWARE_LOG_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-1 min-w-0' },
  customer: { id: 'customer', header: 'Customer', width: 'flex-1 min-w-0', hideAt: 'md' },
  // On a phone the tag keeps its own width, so the device keeps the row (1059:18100).
  status: { id: 'status', header: 'Status', width: 'flex-none content-md:flex-1 content-md:min-w-0' },
  result: { id: 'result', width: 'w-12 shrink-0 flex-none content-md:w-[176px]', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LOG_COLUMNS };
