import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/** Column layout of the Checks list, read by its live columns and its loading form alike. */
export const CHECK_COLUMNS = {
  check: { id: 'check', header: 'Check', width: 'flex-1 min-w-0' },
  severity: { id: 'severity', header: 'Severity', width: 'w-[120px]', hideAt: 'md' },
  threshold: { id: 'threshold', header: 'Threshold', width: 'w-[320px]', hideAt: 'md' },
  enabled: { id: 'enabled', header: 'Enabled', width: 'w-[72px] content-md:w-[96px]' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;
