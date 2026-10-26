import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Software table, shared by every surface that draws the table (the fleet-wide page and a device's
 * Software tab) — see `table-column-layout.ts` for why this module is data-only
 * (no imports, no JSX).
 *
 * Sortable ids ARE the backend sort fields, so a header, the query and the
 * address bar agree on one string.
 */
const SOFTWARE_LIST_COLUMNS = {
  name: { id: 'name', header: 'Software', width: 'flex-1 min-w-0' },
  currentVersion: { id: 'currentVersion', header: 'Current Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  // VULNS sorts by the CVE count, the one figure the column shows.
  vulnerabilities: { id: 'cveCount', header: 'Vulns', width: 'w-[96px]', sortable: true },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LIST_COLUMNS };

/**
 * The only values allowed to reach `SortInput.field` — everything else in the
 * URL falls back to the backend's own order. `softwares` and `deviceSoftware`
 * both sort by these (and by name, devices and highest severity, which the
 * table does not offer).
 */
export const SOFTWARE_LIST_SORTABLE_COLUMN_IDS: readonly string[] = [SOFTWARE_LIST_COLUMNS.vulnerabilities.id];

export const SOFTWARE_LIST_PAGE_SIZE = 20;
