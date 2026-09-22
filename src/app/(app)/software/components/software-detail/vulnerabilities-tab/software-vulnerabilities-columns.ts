import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for Software → Vulnerabilities, shared by the live table and
 * its `<Suspense>` skeleton — see `table-column-layout.ts` for why this module
 * is data-only (no imports, no JSX).
 */
const SOFTWARE_VULNERABILITY_COLUMNS = {
  cveId: { id: 'cveId', header: 'CVE ID', width: 'flex-1 min-w-0' },
  affectedVersion: { id: 'affectedVersion', header: 'Version', width: 'flex-1 min-w-0', hideAt: 'md' },
  // The id is the backend sort field: when Fleet first matched the CVE
  // against this title, not the CVE's publication date.
  discoveredAt: {
    id: 'discoveredAt',
    header: 'Discovered',
    width: 'w-[140px] md:w-[180px]',
    hideAt: 'lg',
    sortable: true,
  },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_VULNERABILITY_COLUMNS };

/** Render order for the live table and its skeleton. */
export const SOFTWARE_VULNERABILITIES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_VULNERABILITY_COLUMNS.cveId,
  SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion,
  SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt,
  SOFTWARE_VULNERABILITY_COLUMNS.open,
];

/** Backend sort fields this list offers — anything else in the URL is ignored. */
export const SOFTWARE_VULNERABILITIES_SORTABLE_COLUMN_IDS: readonly string[] = [
  SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt.id,
];

export const SOFTWARE_VULNERABILITIES_PAGE_SIZE = 20;
