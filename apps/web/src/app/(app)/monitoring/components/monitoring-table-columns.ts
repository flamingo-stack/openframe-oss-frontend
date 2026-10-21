import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the two monitoring detail device tables — the policy detail
 * page's Devices section and the query detail page's Assigned Devices tab.
 *
 * Data-only on purpose (see `table-column-layout.ts`): each table reads its
 * columns' header, width and breakpoint from here, loaded or loading (in a
 * loading scope the same table draws its own body skeleton).
 *
 * The two tables are the same layout down to the class strings; they differ in
 * exactly two things, and both are spelled out below rather than left implicit:
 * the STATUS column means different things (policy compliance vs the device's
 * own state, so a different `id` and accessor), and only the query table offers
 * column funnels (the live columns' `meta.filter`; the layout here is the same).
 *
 * Headers are the real uppercase strings the tables pass; `DataTable`
 * uppercases them in CSS anyway, but keeping them verbatim means a diff here is
 * a diff in exactly one place.
 */

const DEVICE = { id: 'device', header: 'DEVICE', width: 'flex-1 content-md:w-1/3' } satisfies TableSkeletonColumn;
const ORGANIZATION = {
  id: 'organization',
  header: 'CUSTOMER',
  width: 'w-1/6',
  hideAt: 'lg',
} satisfies TableSkeletonColumn;
const OS = { id: 'os', header: 'OS', width: 'w-[120px] content-md:w-1/6', hideAt: 'md' } satisfies TableSkeletonColumn;
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
  width: 'w-12 content-md:w-[160px] shrink-0 flex-none',
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

/** Query detail → Assigned Devices. Same layout; its live columns add funnels on three headers. */
export const QUERY_DEVICE_COLUMNS = {
  device: DEVICE,
  organization: ORGANIZATION,
  os: OS,
  /** The device's own online state — hence `status`, where the policy table says `compliance`. */
  status: { id: 'status', header: 'STATUS', width: 'w-[140px]' },
  open: OPEN,
  quickQuery: QUICK_QUERY,
} satisfies Record<string, TableSkeletonColumn>;
