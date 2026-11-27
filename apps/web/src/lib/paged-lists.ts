/**
 * What each paged list's API can do for the Prev / Next pager (`useCursorPager` in the core lib). One place, so a list
 * gains server-side Prev in one line when the backend task CU-17tkuw68auf lands for it.
 *
 * - `serverPrev`: `last` / `before` return the page BEFORE the cursor, in display order. Off where the API pages
 *   forward only (no `last/before` in the schema), where `before: startCursor` reloads the same page (page-index
 *   cursors, `PageCursors`), and where `before` is accepted but the NEXT page comes back (devices, assignedDevices,
 *   availableDevices, logs: `before` must never be sent there until the backend fix).
 * - `reliableHasPrev`: `hasPreviousPage` is false on a forward page 2+ only when the server ignored the cursor and
 *   answered page 1, so the pager can catch that silent fallback (`isStaleCursorPage`). On where the backend code was
 *   read to set it from the page index; off elsewhere until checked.
 *
 * The pager pages back through browser history everywhere; these only decide Prev on a shared link.
 *
 * Backend task CU-17tkuw68auf (backward paging and an `INVALID_CURSOR` error on the list APIs) is not deployed yet.
 * Once saas-tenant ships it, a row flips to `serverPrev` here, list by list, after the deployed schema shows `last` /
 * `before` on that list and a page back returns the rows before the cursor.
 */

export interface PagedListCaps {
  serverPrev: boolean;
  reliableHasPrev: boolean;
}

const FORWARD_ONLY: PagedListCaps = { serverPrev: false, reliableHasPrev: false };
const SERVER_PREV: PagedListCaps = { serverPrev: true, reliableHasPrev: false };
/**
 * Page-index cursors (`PageCursors`): a cursor the server cannot read decodes to page 0 and answers page 1, and
 * `hasPreviousPage` is `page > 0` (`SoftwareInventoryService`, `VulnerabilityInventoryService`,
 * `TenantSoftwareReadModelQuery`, `SoftwareActionService`), so page 2+ saying "nothing before" is that fallback.
 */
const PAGE_INDEX: PagedListCaps = { serverPrev: false, reliableHasPrev: true };

export const PAGED_LISTS = {
  // Group A: last/before works.
  scriptExecutions: SERVER_PREV,
  scheduleExecutions: SERVER_PREV,
  scheduleRuns: SERVER_PREV,
  // The scripts table sends no sort, so its cursor always follows the default order `before` pages back on.
  scripts: SERVER_PREV,
  scriptSchedules: SERVER_PREV,
  // Group B: page-index cursors; `before: startCursor` reloads the same page until the backend fix.
  softwares: PAGE_INDEX,
  vulnerabilities: PAGE_INDEX,
  softwareActions: PAGE_INDEX,
  softwareDevices: PAGE_INDEX,
  softwareVulnerabilities: PAGE_INDEX,
  vulnerabilityDevices: PAGE_INDEX,
  deviceSoftware: PAGE_INDEX,
  deviceVulnerabilities: PAGE_INDEX,
  // Group C: `before` returns the NEXT page. Never send it.
  assignedDevices: FORWARD_ONLY,
  logs: FORWARD_ONLY,
  // Group D: forward only in the schema.
  users: FORWARD_ONLY,
  timeEntries: FORWARD_ONLY,
  remoteSessions: FORWARD_ONLY,
  invitations: FORWARD_ONLY,
  knowledgeBaseItems: FORWARD_ONLY,
  archivedArticles: FORWARD_ONLY,
  assignedItems: FORWARD_ONLY,
  insights: FORWARD_ONLY,
  directoryConnections: FORWARD_ONLY,
  directoryUsers: FORWARD_ONLY,
  directoryGroups: FORWARD_ONLY,
  groupMembers: FORWARD_ONLY,
  accountGroups: FORWARD_ONLY,
} as const satisfies Record<string, PagedListCaps>;

export type PagedListId = keyof typeof PAGED_LISTS;
