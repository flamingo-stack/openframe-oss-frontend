import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/** Column layout of the Checks list, read by its live columns and its loading form alike. */
export const CHECK_COLUMNS = {
  check: { id: 'check', header: 'Check', width: 'flex-1 min-w-0', sortable: true },
  severity: { id: 'severity', header: 'Severity', width: 'w-[120px]', hideAt: 'md' },
  threshold: { id: 'threshold', header: 'Threshold', width: 'w-[200px] content-lg:w-[240px]', hideAt: 'md' },
  exceptions: { id: 'exceptions', header: 'Exceptions', width: 'w-[112px]', hideAt: 'lg' },
  enabled: { id: 'enabled', header: 'Enabled', width: 'w-[72px] content-md:w-[96px]' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * The data columns' widths in the grid table, in px (the design's, 1056px of table). The design's Incidents and
 * Last edited columns have no data in the API yet, so Check takes their width; Enabled, the last data column, takes
 * whatever a wider table adds.
 */
export const CHECK_GRID_SIZES = { check: 478, severity: 116, threshold: 170, exceptions: 100, enabled: 80 } as const;
