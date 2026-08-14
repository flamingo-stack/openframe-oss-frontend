import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the device-detail table tabs.
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
 */

const USER_COLUMNS = {
  username: { id: 'username', header: 'USER', width: 'flex-1 min-w-0' },
  uid: { id: 'uid', header: 'UID', width: 'w-[100px] shrink-0' },
  type: { id: 'type', header: 'TYPE', width: 'w-[120px] shrink-0', hideAt: 'md' },
  groupname: { id: 'groupname', header: 'GROUP', width: 'w-[160px] shrink-0', hideAt: 'lg' },
  shell: { id: 'shell', header: 'SHELL', width: 'w-[200px] shrink-0', hideAt: 'lg' },
  status: { id: 'status', header: 'STATUS', width: 'w-[120px] shrink-0', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

const SOFTWARE_COLUMNS = {
  name: { id: 'name', header: 'SOFTWARE', width: 'flex-1 min-w-0' },
  source: { id: 'source', header: 'SOURCE', width: 'w-[180px] shrink-0', hideAt: 'lg' },
  vulnerabilities: { id: 'vulnerabilities', header: 'VULNERABILITIES', width: 'w-[160px] shrink-0' },
  filePath: { id: 'file_path', header: 'FILE PATH', width: 'w-[220px] shrink-0', hideAt: 'lg' },
  lastUsed: { id: 'last_opened_at', header: 'LAST USED', width: 'w-[140px] shrink-0', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * Below `md` the row is CVE + severity + the details button only. The percentage
 * widths this table uses on desktop are unusable there — on a 375px viewport the
 * row's inner width is ~310px, so `20%`/`16%` resolve to ~62px/~50px and the row
 * (which is `overflow-hidden`) clipped both the CVE id and the severity tag.
 * So CVE takes the leftover space, severity gets the fixed width its tag needs,
 * and SOFTWARE drops out of the row — `VulnerabilitiesTab` folds the package name
 * into the CVE cell as a second line there, which DISCOVERED has no equivalent of
 * and is the least useful of the three for mobile triage anyway.
 */
const VULNERABILITY_COLUMNS = {
  cve: { id: 'cve', header: 'CVE ID', width: 'flex-1 min-w-0 md:flex-none md:w-[20%]' },
  severity: { id: 'severity', header: 'SEVERITY', width: 'w-[88px] md:w-[16%]', sortable: true },
  software: { id: 'software_name', header: 'SOFTWARE', width: 'flex-1 min-w-0', hideAt: 'md' },
  discovered: { id: 'created_at', header: 'DISCOVERED', width: 'w-[18%]', sortable: true, hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SOFTWARE_COLUMNS, USER_COLUMNS, VULNERABILITY_COLUMNS };

/** Users tab — render order for the live table and the page skeleton. */
export const USERS_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  USER_COLUMNS.username,
  USER_COLUMNS.uid,
  USER_COLUMNS.type,
  USER_COLUMNS.groupname,
  USER_COLUMNS.shell,
  USER_COLUMNS.status,
];

/** Software tab — render order for the live table and the page skeleton. */
export const SOFTWARE_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  SOFTWARE_COLUMNS.name,
  SOFTWARE_COLUMNS.source,
  SOFTWARE_COLUMNS.vulnerabilities,
  SOFTWARE_COLUMNS.filePath,
  SOFTWARE_COLUMNS.lastUsed,
];

/** Vulnerabilities tab — render order for the live table and the page skeleton. */
export const VULNERABILITIES_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  VULNERABILITY_COLUMNS.cve,
  VULNERABILITY_COLUMNS.severity,
  VULNERABILITY_COLUMNS.software,
  VULNERABILITY_COLUMNS.discovered,
  VULNERABILITY_COLUMNS.open,
];
