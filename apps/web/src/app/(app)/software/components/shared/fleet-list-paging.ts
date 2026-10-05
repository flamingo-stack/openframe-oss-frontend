/**
 * Paging and search pacing for the lists the backend answers out of Fleet —
 * software titles, CVEs, and the devices under either, fleet-wide and per device.
 *
 * None of them is paged at the source: every request rebuilds the WHOLE list in
 * memory (the full Fleet catalog, every host of every version) and returns one
 * slice of it. So the request count is the load, not the page size — a page of
 * 20 meant a full rebuild per 20 rows scrolled, and one per pause in typing.
 * Larger pages and a longer pause are the client's two levers until the backend
 * keeps the built list between requests.
 */
export const FLEET_LIST_PAGE_SIZE = 100;

/** What a loading table draws — a screenful, not a page: 100 placeholder rows would only cost DOM. */
export const FLEET_LIST_SKELETON_ROWS = 20;

/** Each settled search term is a full rebuild on the backend, so wait for the user to finish typing. */
export const FLEET_SEARCH_DEBOUNCE_MS = 500;
