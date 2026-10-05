import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { FLEET_LIST_PAGE_SIZE } from '../shared/fleet-list-paging';

/**
 * Column layout for the Software table, shared by the live table, its skeleton
 * and every surface that draws the table (the fleet-wide page and a device's
 * Software tab) — see `table-column-layout.ts` for why this module is data-only
 * (no imports, no JSX).
 *
 * The record is the declaration; the array below fixes the render ORDER.
 */
const SOFTWARE_LIST_COLUMNS = {
  name: { id: 'name', header: 'Software', width: 'flex-1 min-w-0' },
  currentVersion: { id: 'currentVersion', header: 'Current Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  vulnerabilities: { id: 'cveCount', header: 'Vulns', width: 'w-[96px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LIST_COLUMNS };

/** Render order for the live table and its skeleton. */
export const SOFTWARE_LIST_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_LIST_COLUMNS.name,
  SOFTWARE_LIST_COLUMNS.currentVersion,
  SOFTWARE_LIST_COLUMNS.vulnerabilities,
  SOFTWARE_LIST_COLUMNS.open,
];

export const SOFTWARE_LIST_PAGE_SIZE = FLEET_LIST_PAGE_SIZE;
