import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the monitoring detail tables.
 *
 * Data-only on purpose (see `table-column-layout.ts`): the policy devices table
 * is drawn by two renderers — the live `PolicyDevicesTable` and
 * `MonitoringDetailSkeleton`, which stands in for the page while the Fleet
 * request is in flight. Both read the SAME declaration, so the skeleton's header
 * cannot drift from the loaded one's the way every other pair did before their
 * layouts were centralised.
 *
 * Headers are the real uppercase strings the table passes; `DataTable`
 * uppercases them in CSS anyway, but keeping them verbatim means a diff here is
 * a diff in exactly one place.
 */

const POLICY_DEVICE_COLUMNS = {
  device: { id: 'device', header: 'DEVICE', width: 'flex-1 md:w-1/3' },
  organization: { id: 'organization', header: 'CUSTOMER', width: 'w-1/6', hideAt: 'lg' },
  os: { id: 'os', header: 'OS', width: 'w-[120px] md:w-1/6', hideAt: 'md' },
  compliance: { id: 'compliance', header: 'STATUS', width: 'w-[140px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  /**
   * Wider than an icon cell from `md` up because the live cell holds a
   * `w-full` Quick Query / Close toggle — the fixed width is what keeps the two
   * button labels the same size, so it is layout-affecting rather than cosmetic.
   */
  quickQuery: { id: 'quick-query', width: 'w-12 md:w-[160px] shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { POLICY_DEVICE_COLUMNS };

/** Policy detail Devices table — render order for the live table and the page skeleton. */
export const POLICY_DEVICES_COLUMNS: readonly TableSkeletonColumn[] = [
  POLICY_DEVICE_COLUMNS.device,
  POLICY_DEVICE_COLUMNS.organization,
  POLICY_DEVICE_COLUMNS.os,
  POLICY_DEVICE_COLUMNS.compliance,
  POLICY_DEVICE_COLUMNS.open,
  POLICY_DEVICE_COLUMNS.quickQuery,
];

/**
 * Query detail → Query Results tab.
 *
 * `QueryReportTable` derives its columns from the report rows, so only the two
 * the view pins through `columnOrder` are known before the request answers —
 * which is exactly what the skeleton can honestly draw.
 */
export const QUERY_REPORT_COLUMNS: readonly TableSkeletonColumn[] = [
  { id: 'host_name', header: 'HOST NAME', width: 'flex-1 min-w-0' },
  { id: 'last_fetched', header: 'LAST FETCHED', width: 'w-[220px] shrink-0' },
];
