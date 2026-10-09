import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the device-detail table tabs that draw their own tables.
 *
 * Data-only on purpose (see `table-column-layout.ts`): each of these tables is
 * drawn by two renderers — the live tab and `DeviceDetailsSkeleton`, which
 * covers the tab while the device request is in flight. Both now read the SAME
 * declaration; when they each kept their own copy the skeleton had drifted on
 * every one of these tables (missing `hideAt`, missing `align`, and a `source`
 * column 40px too narrow), so the header re-laid-out the moment data arrived.
 *
 * Headers are the real uppercase strings the tabs pass; `DataTable` uppercases
 * them in CSS anyway, but keeping them verbatim means a diff here is a diff in
 * exactly one place.
 *
 * The Software and Vulnerabilities tabs each have two layouts: the `FLEET_*`
 * ones below, drawn over the Fleet host payload while `software-management` is
 * off, and the Software module's (`software-list-columns.ts` /
 * `vulnerability-list-columns.ts`) once it is on — see `software-tab.tsx`.
 */

const USER_COLUMNS = {
  username: { id: 'username', header: 'USER', width: 'flex-1 min-w-0' },
  uid: { id: 'uid', header: 'UID', width: 'w-[100px] shrink-0' },
  type: { id: 'type', header: 'TYPE', width: 'w-[120px] shrink-0', hideAt: 'md' },
  groupname: { id: 'groupname', header: 'GROUP', width: 'w-[160px] shrink-0', hideAt: 'lg' },
  shell: { id: 'shell', header: 'SHELL', width: 'w-[200px] shrink-0', hideAt: 'lg' },
  status: { id: 'status', header: 'STATUS', width: 'w-[120px] shrink-0', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** Software tab over the Fleet host payload (`software-management` off). */
const FLEET_SOFTWARE_COLUMNS = {
  name: { id: 'name', header: 'SOFTWARE', width: 'flex-1 min-w-0' },
  source: { id: 'source', header: 'SOURCE', width: 'w-[180px] shrink-0', hideAt: 'lg' },
  vulnerabilities: { id: 'vulnerabilities', header: 'VULNERABILITIES', width: 'w-[160px] shrink-0' },
  filePath: { id: 'file_path', header: 'FILE PATH', width: 'w-[220px] shrink-0', hideAt: 'lg' },
  lastUsed: { id: 'last_opened_at', header: 'LAST USED', width: 'w-[140px] shrink-0', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * Vulnerabilities tab over the Fleet host payload (`software-management` off).
 *
 * Below `md` the row is CVE + severity + the details button only. The percentage
 * widths this table uses on desktop are unusable there — on a 375px viewport the
 * row's inner width is ~310px, so `20%`/`16%` resolve to ~62px/~50px and the row
 * (which is `overflow-hidden`) clipped both the CVE id and the severity tag.
 * So CVE takes the leftover space, severity gets the fixed width its tag needs,
 * and SOFTWARE drops out of the row — `FleetVulnerabilitiesTab` folds the package
 * name into the CVE cell as a second line there, which DISCOVERED has no
 * equivalent of and is the least useful of the three for mobile triage anyway.
 */
const FLEET_VULNERABILITY_COLUMNS = {
  cve: { id: 'cve', header: 'CVE ID', width: 'flex-1 min-w-0 content-md:flex-none content-md:w-[20%]' },
  severity: { id: 'severity', header: 'SEVERITY', width: 'w-[88px] content-md:w-[16%]', sortable: true },
  software: { id: 'software_name', header: 'SOFTWARE', width: 'flex-1 min-w-0', hideAt: 'md' },
  discovered: { id: 'created_at', header: 'DISCOVERED', width: 'w-[18%]', sortable: true, hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * Remote Sessions tab (Figma 744-40363, mobile 758-46869): three equal content
 * columns plus one actions cell holding both the delete and the open button -
 * a single column so its header can carry the results count the mockup shows
 * above the buttons. On mobile the row is date + actions only.
 */
const REMOTE_SESSION_COLUMNS = {
  session: { id: 'session', header: 'SESSION', width: 'flex-1 min-w-0', dateFilterable: true },
  employee: { id: 'employee', header: 'EMPLOYEE', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  duration: { id: 'duration', header: 'DURATION', width: 'flex-1 min-w-0', hideAt: 'md', sortable: true },
  expires: { id: 'expires', header: 'EXPIRES', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  actions: { id: 'actions', width: 'w-[112px] shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { FLEET_SOFTWARE_COLUMNS, FLEET_VULNERABILITY_COLUMNS, REMOTE_SESSION_COLUMNS, USER_COLUMNS };

/** Users tab — render order for the live table and the page skeleton. */
export const USERS_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  USER_COLUMNS.username,
  USER_COLUMNS.uid,
  USER_COLUMNS.type,
  USER_COLUMNS.groupname,
  USER_COLUMNS.shell,
  USER_COLUMNS.status,
];

/** Fleet-backed Software tab — render order for the live table and the page skeleton. */
export const FLEET_SOFTWARE_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  FLEET_SOFTWARE_COLUMNS.name,
  FLEET_SOFTWARE_COLUMNS.source,
  FLEET_SOFTWARE_COLUMNS.vulnerabilities,
  FLEET_SOFTWARE_COLUMNS.filePath,
  FLEET_SOFTWARE_COLUMNS.lastUsed,
];

/** Fleet-backed Vulnerabilities tab — render order for the live table and the page skeleton. */
export const FLEET_VULNERABILITIES_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  FLEET_VULNERABILITY_COLUMNS.cve,
  FLEET_VULNERABILITY_COLUMNS.severity,
  FLEET_VULNERABILITY_COLUMNS.software,
  FLEET_VULNERABILITY_COLUMNS.discovered,
  FLEET_VULNERABILITY_COLUMNS.open,
];

/**
 * Placeholder rows while a tab's list is in flight — the same count the page
 * skeleton draws for it, so the tab's own fallback does not jump when it takes
 * over from the page's.
 */
export const DEVICE_TAB_SKELETON_ROWS = 10;

/** Remote Sessions tab — render order for the live table and the page skeleton. */
export const REMOTE_SESSIONS_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  REMOTE_SESSION_COLUMNS.session,
  REMOTE_SESSION_COLUMNS.employee,
  REMOTE_SESSION_COLUMNS.duration,
  REMOTE_SESSION_COLUMNS.expires,
  REMOTE_SESSION_COLUMNS.actions,
];
