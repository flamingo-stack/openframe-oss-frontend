import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { FLEET_LIST_PAGE_SIZE } from '../shared/fleet-list-paging';

/**
 * Column layout for the Software table, shared by every surface that draws the table (the fleet-wide page and a device's
 * Software tab) — see `table-column-layout.ts` for why this module is data-only
 * (no imports, no JSX).
 */
const SOFTWARE_LIST_COLUMNS = {
  name: { id: 'name', header: 'Software', width: 'flex-1 min-w-0' },
  currentVersion: { id: 'currentVersion', header: 'Current Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  vulnerabilities: { id: 'cveCount', header: 'Vulns', width: 'w-[96px]' },
  // The fleet-wide list's own (design 1076:16413): a device's tab reads one copy, which these say nothing about.
  engine: { id: 'engine', header: 'Engine', width: 'flex-1 min-w-0', hideAt: 'lg' },
  autoUpdate: { id: 'autoUpdate', header: 'Auto-update', width: 'w-[120px]', hideAt: 'md' },
  adoption: { id: 'adoptionCount', header: 'Adoption', width: 'w-[104px]', hideAt: 'lg' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_LIST_COLUMNS };

export const SOFTWARE_LIST_PAGE_SIZE = FLEET_LIST_PAGE_SIZE;
