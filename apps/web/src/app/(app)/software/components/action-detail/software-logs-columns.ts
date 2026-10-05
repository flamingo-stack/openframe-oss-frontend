import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for Software Update Details' per-device logs, shared by the
 * live table and its skeleton — see `table-column-layout.ts` for why this
 * module is data-only.
 */
const SOFTWARE_LOG_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-1 min-w-0' },
  customer: { id: 'customer', header: 'Customer', width: 'flex-1 min-w-0', hideAt: 'md' },
  status: { id: 'status', header: 'Status', width: 'flex-1 min-w-0', filterable: true },
  result: { id: 'result', width: 'w-12 shrink-0 flex-none md:w-[176px]', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LOG_COLUMNS };

/** Render order for the live table and its skeleton. */
export const SOFTWARE_LOG_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_LOG_COLUMNS.device,
  SOFTWARE_LOG_COLUMNS.customer,
  SOFTWARE_LOG_COLUMNS.status,
  SOFTWARE_LOG_COLUMNS.result,
];
