import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the device-detail table tabs that draw their own tables. The
 * Software and Vulnerabilities tabs draw the Software module's shared tables and
 * read their layouts from `software-list-columns.ts` / `vulnerability-list-columns.ts`.
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
  actions: { id: 'actions', width: 'w-[112px] shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { REMOTE_SESSION_COLUMNS, USER_COLUMNS };

/** Users tab — render order for the live table and the page skeleton. */
export const USERS_TAB_COLUMNS: readonly TableSkeletonColumn[] = [
  USER_COLUMNS.username,
  USER_COLUMNS.uid,
  USER_COLUMNS.type,
  USER_COLUMNS.groupname,
  USER_COLUMNS.shell,
  USER_COLUMNS.status,
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
  REMOTE_SESSION_COLUMNS.actions,
];
