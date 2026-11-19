/**
 * What each paged list's API can do for the Prev / Next pager (`useCursorPager` in the core lib). One place, so a list
 * gains server-side Prev in one line when the backend task CU-17tkuw68auf lands for it.
 *
 * - `serverPrev`: `last` / `before` return the page BEFORE the cursor, in display order. Off where the API pages
 *   forward only (no `last/before` in the schema), where `before: startCursor` reloads the same page (page-index
 *   cursors, `PageCursors`), and where `before` is accepted but the NEXT page comes back (devices, assignedDevices,
 *   availableDevices, logs: `before` must never be sent there until the backend fix).
 * - `reliableHasPrev`: `hasPreviousPage` is false on a forward page 2+ only when the server ignored the cursor and
 *   answered page 1, so the pager can catch that silent fallback (`isStaleCursorPage`). Off until checked per list.
 *
 * The pager pages back through browser history everywhere; these only decide Prev on a shared link.
 */

export interface PagedListCaps {
  serverPrev: boolean;
  reliableHasPrev: boolean;
}

const FORWARD_ONLY: PagedListCaps = { serverPrev: false, reliableHasPrev: false };
const SERVER_PREV: PagedListCaps = { serverPrev: true, reliableHasPrev: false };

export const PAGED_LISTS = {
  // Group A: last/before works.
  scriptExecutions: SERVER_PREV,
  scheduleExecutions: SERVER_PREV,
  scheduleRuns: SERVER_PREV,
  // Group B: page-index cursors; `before: startCursor` reloads the same page until the backend fix.
  softwares: FORWARD_ONLY,
  vulnerabilities: FORWARD_ONLY,
  softwareActions: FORWARD_ONLY,
  softwareDevices: FORWARD_ONLY,
  softwareVulnerabilities: FORWARD_ONLY,
  vulnerabilityDevices: FORWARD_ONLY,
  deviceSoftware: FORWARD_ONLY,
  deviceVulnerabilities: FORWARD_ONLY,
  // Group C: `before` returns the NEXT page. Never send it.
  assignedDevices: FORWARD_ONLY,
  // Group D: forward only in the schema.
  users: FORWARD_ONLY,
  timeEntries: FORWARD_ONLY,
  remoteSessions: FORWARD_ONLY,
} as const satisfies Record<string, PagedListCaps>;

export type PagedListId = keyof typeof PAGED_LISTS;
