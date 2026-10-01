import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { FLEET_LIST_PAGE_SIZE } from '../shared/fleet-list-paging';

/**
 * Column layout for the Software table, shared by the live table, its skeleton
 * and every surface that draws the table (the fleet-wide page and a device's
 * Software tab) — see `table-column-layout.ts` for why this module is data-only
 * (no imports, no JSX).
 *
 * The record is the declaration; the array below fixes the render ORDER.
 * Sortable ids ARE the backend sort fields and the funnel's column id IS the key
 * its selection travels under in the URL, so a header, the query and the
 * address bar agree on one string.
 */
const SOFTWARE_LIST_COLUMNS = {
  name: { id: 'name', header: 'Software', width: 'flex-1 min-w-0' },
  // Carries the version-status funnel (up to date / outdated / unknown) — but
  // NOT `filterable` here: the live table draws that funnel only when the facet
  // answers with options, so a skeleton that promised it would show a control
  // the loaded table then takes away.
  currentVersion: { id: 'currentVersion', header: 'Current Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  // DEVICES carries the one server-side sort toggle; VULNS is not sortable.
  devicesCount: { id: 'devicesCount', header: 'Devices', width: 'w-[100px] md:w-[144px]', sortable: true },
  vulnerabilities: { id: 'cveCount', header: 'Vulns', width: 'w-[96px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LIST_COLUMNS };

/** Render order for the live table and its skeleton. */
export const SOFTWARE_LIST_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_LIST_COLUMNS.name,
  SOFTWARE_LIST_COLUMNS.currentVersion,
  SOFTWARE_LIST_COLUMNS.devicesCount,
  SOFTWARE_LIST_COLUMNS.vulnerabilities,
  SOFTWARE_LIST_COLUMNS.open,
];

/**
 * The only values allowed to reach `SortInput.field` — everything else in the
 * URL falls back to the backend's own order. `softwares` and `deviceSoftware`
 * both sort by these (and by name, highest severity and CVE count, which the
 * table does not offer).
 */
export const SOFTWARE_LIST_SORTABLE_COLUMN_IDS: readonly string[] = [SOFTWARE_LIST_COLUMNS.devicesCount.id];

/** The funnels' column ids — the keys their selections travel under in the URL. */
export const SOFTWARE_LIST_FILTER_COLUMN_IDS: readonly string[] = [SOFTWARE_LIST_COLUMNS.currentVersion.id];

export const SOFTWARE_LIST_PAGE_SIZE = FLEET_LIST_PAGE_SIZE;
