import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Software list table, shared by the live table and its
 * `<Suspense>` skeleton — see `table-column-layout.ts` for why this module is
 * data-only (no imports, no JSX).
 *
 * The record is the declaration; the array below fixes the render ORDER.
 */
const SOFTWARE_LIST_COLUMNS = {
  name: { id: 'name', header: 'Software', width: 'flex-1 min-w-0' },
  currentVersion: { id: 'currentVersion', header: 'Current Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  // DEVICES and VULNS carry the server-side sort toggles (see SORTABLE_COLUMN_IDS).
  devicesCount: { id: 'devicesCount', header: 'Devices', width: 'w-[100px] md:w-[144px]', sortable: true },
  vulnerabilities: { id: 'severity', header: 'Vulns', width: 'w-[96px]', sortable: true },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LIST_COLUMNS };

/** `/software` — render order for the live table and its skeleton. */
export const SOFTWARE_LIST_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_LIST_COLUMNS.name,
  SOFTWARE_LIST_COLUMNS.currentVersion,
  SOFTWARE_LIST_COLUMNS.devicesCount,
  SOFTWARE_LIST_COLUMNS.vulnerabilities,
  SOFTWARE_LIST_COLUMNS.open,
];

/**
 * The only values allowed to reach `SortInput.field` — everything else in the
 * URL falls back to the backend's own order. Ids match the column ids of the
 * two sortable headers (DEVICES / VULNS) so the header indicator and the
 * backend field are the same string.
 */
export const SOFTWARE_LIST_SORTABLE_COLUMN_IDS: readonly string[] = [
  SOFTWARE_LIST_COLUMNS.devicesCount.id,
  SOFTWARE_LIST_COLUMNS.vulnerabilities.id,
];

export const SOFTWARE_LIST_PAGE_SIZE = 20;
