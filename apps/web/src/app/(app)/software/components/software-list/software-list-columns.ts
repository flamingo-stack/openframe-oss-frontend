import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Software table, shared by every surface that draws the table (the fleet-wide page and a device's
 * Software tab) — see `table-column-layout.ts` for why this module is data-only
 * (no imports, no JSX).
 */
const SOFTWARE_LIST_COLUMNS = {
  name: { id: 'name', header: 'Software', width: 'flex-1 min-w-0' },
  currentVersion: { id: 'currentVersion', header: 'Current Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  // Sorted by the CVE count it shows; the id is the backend sort field.
  vulnerabilities: { id: 'cveCount', header: 'Vulns', width: 'w-[96px]', sortable: true },
  // The fleet-wide list's own (design 1076:16413): a device's tab reads one copy, which these say nothing about.
  // Desktop only: below that the name cell carries the logo (tablet 1098:309, phone 1098:17357).
  os: { id: 'os', header: 'OS', width: 'w-[72px]', hideAt: 'lg' },
  engine: { id: 'engine', header: 'Engine', width: 'flex-1 min-w-0', hideAt: 'lg' },
  // Wide enough for its funnel beside the result count, which the table draws over the row's end. On a phone the value
  // stays beside the open button (1098:17357), at its own width.
  autoUpdate: { id: 'autoUpdate', header: 'Auto-update', width: 'shrink-0 content-md:w-[160px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LIST_COLUMNS };

/** A device's list sorts by its Vulns column; anything else in the URL falls back to the backend's own order. */
export const DEVICE_SOFTWARE_SORTABLE_COLUMN_IDS: readonly string[] = [SOFTWARE_LIST_COLUMNS.vulnerabilities.id];

export const SOFTWARE_LIST_PAGE_SIZE = 20;
