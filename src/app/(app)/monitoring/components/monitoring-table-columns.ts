import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the two monitoring detail device tables — the policy detail
 * page's Devices section and the query detail page's Assigned Devices tab.
 *
 * Data-only on purpose (see `table-column-layout.ts`): each table is drawn by
 * two renderers — the live one and `MonitoringDetailSkeleton`, which stands in
 * for the page while the Fleet request is in flight. Both read the SAME
 * declaration, so a skeleton header cannot drift from the loaded one's the way
 * every other pair did before their layouts were centralised.
 *
 * The two tables are the same layout down to the class strings; they differ in
 * exactly two things, and both are spelled out below rather than left implicit:
 * the STATUS column means different things (policy compliance vs the device's
 * own state, so a different `id` and accessor), and only the query table offers
 * column funnels. The funnels are not cosmetic — `DataTable.Header` keeps a
 * filterable header alive below `lg` and draws the icon beside its label — so
 * the skeleton has to know about them, which is what `filterable` is for.
 *
 * Headers are the real uppercase strings the tables pass; `DataTable`
 * uppercases them in CSS anyway, but keeping them verbatim means a diff here is
 * a diff in exactly one place.
 */

const DEVICE = { id: 'device', header: 'DEVICE', width: 'flex-1 md:w-1/3' } satisfies TableSkeletonColumn;
const ORGANIZATION = {
  id: 'organization',
  header: 'CUSTOMER',
  width: 'w-1/6',
  hideAt: 'lg',
} satisfies TableSkeletonColumn;
const OS = { id: 'os', header: 'OS', width: 'w-[120px] md:w-1/6', hideAt: 'md' } satisfies TableSkeletonColumn;
const OPEN = {
  id: 'open',
  width: 'w-12 shrink-0 flex-none',
  hideAt: 'md',
  align: 'right',
} satisfies TableSkeletonColumn;
/**
 * Wider than an icon cell from `md` up because the live cell holds a `w-full`
 * Quick Query / Close toggle — the fixed width is what keeps the two button
 * labels the same size, so it is layout-affecting rather than cosmetic.
 */
const QUICK_QUERY = {
  id: 'quick-query',
  width: 'w-12 md:w-[160px] shrink-0 flex-none',
  align: 'right',
} satisfies TableSkeletonColumn;

/** Policy detail → Devices. No column funnels on this one. */
export const POLICY_DEVICE_COLUMNS = {
  device: DEVICE,
  organization: ORGANIZATION,
  os: OS,
  /** The device's compliance with THIS policy, not its own online state. */
  compliance: { id: 'compliance', header: 'STATUS', width: 'w-[140px]' },
  open: OPEN,
  quickQuery: QUICK_QUERY,
} satisfies Record<string, TableSkeletonColumn>;

/** Query detail → Assigned Devices. Same layout, plus funnels on three headers. */
export const QUERY_DEVICE_COLUMNS = {
  device: DEVICE,
  organization: { ...ORGANIZATION, filterable: true },
  os: { ...OS, filterable: true },
  /** The device's own online state — hence `status`, where the policy table says `compliance`. */
  status: { id: 'status', header: 'STATUS', width: 'w-[140px]', filterable: true },
  open: OPEN,
  quickQuery: QUICK_QUERY,
} satisfies Record<string, TableSkeletonColumn>;

/** Render order — the live table and the page skeleton read the same list. */
export const POLICY_DEVICES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  POLICY_DEVICE_COLUMNS.device,
  POLICY_DEVICE_COLUMNS.organization,
  POLICY_DEVICE_COLUMNS.os,
  POLICY_DEVICE_COLUMNS.compliance,
  POLICY_DEVICE_COLUMNS.open,
  POLICY_DEVICE_COLUMNS.quickQuery,
];

/** Render order — the live table and the page skeleton read the same list. */
export const QUERY_DEVICES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  QUERY_DEVICE_COLUMNS.device,
  QUERY_DEVICE_COLUMNS.organization,
  QUERY_DEVICE_COLUMNS.os,
  QUERY_DEVICE_COLUMNS.status,
  QUERY_DEVICE_COLUMNS.open,
  QUERY_DEVICE_COLUMNS.quickQuery,
];
