import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layouts for the two Software detail tabs, shared by each live table and
 * its `<Suspense>` skeleton — see `table-column-layout.ts` for why this module
 * is data-only (no imports, no JSX).
 */

const SOFTWARE_DEVICE_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-1 min-w-0' },
  // Carries BOTH controls the design puts on this tab: the sort toggle (the
  // version) and the per-device status funnel (the chip beside it).
  softwareVersion: {
    id: 'softwareVersion',
    header: 'Software Version',
    width: 'flex-1 min-w-0',
    sortable: true,
    filterable: true,
  },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

const SOFTWARE_VULNERABILITY_COLUMNS = {
  cveId: { id: 'cveId', header: 'CVE ID', width: 'flex-1 min-w-0' },
  severity: { id: 'severity', header: 'Severity', width: 'w-[140px] md:w-[180px]', filterable: true },
  affectedVersion: { id: 'affectedVersion', header: 'Version', width: 'flex-1 min-w-0', hideAt: 'md', sortable: true },
  publishedAt: {
    id: 'publishedAt',
    header: 'Published',
    width: 'w-[140px] md:w-[180px]',
    hideAt: 'lg',
    sortable: true,
  },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_DEVICE_COLUMNS, SOFTWARE_VULNERABILITY_COLUMNS };

/** Devices tab — render order for the live table and its skeleton. */
export const SOFTWARE_DEVICES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_DEVICE_COLUMNS.device,
  SOFTWARE_DEVICE_COLUMNS.softwareVersion,
  SOFTWARE_DEVICE_COLUMNS.open,
];

/** Vulnerabilities tab — render order for the live table and its skeleton. */
export const SOFTWARE_VULNERABILITIES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_VULNERABILITY_COLUMNS.cveId,
  SOFTWARE_VULNERABILITY_COLUMNS.severity,
  SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion,
  SOFTWARE_VULNERABILITY_COLUMNS.publishedAt,
  SOFTWARE_VULNERABILITY_COLUMNS.open,
];
