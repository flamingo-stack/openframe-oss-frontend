import type { TicketListSort, TicketListSortField } from '../services/ticket-service.types';

/** The only field the tickets table sorts by (its TICKET header). */
export const TICKET_NUMBER_SORT_FIELD: TicketListSortField = 'ticketNumber';

/** The list's default: newest tickets first, i.e. the highest numbers on top. */
export const DEFAULT_TICKET_LIST_SORT: TicketListSort = { field: TICKET_NUMBER_SORT_FIELD, direction: 'DESC' };

/**
 * Reads the list sort from its `?sortDir=` URL param. Anything but `asc`
 * (absent, empty, a hand-edited value) is the default DESC, so a stale URL can
 * never leave the list in a state the header does not show.
 */
export function parseTicketListSort(sortDir: string): TicketListSort {
  return sortDir === 'asc' ? { field: TICKET_NUMBER_SORT_FIELD, direction: 'ASC' } : DEFAULT_TICKET_LIST_SORT;
}

/**
 * The URL param for a sort. `useApiParams` drops a value that is empty or
 * equals the declared default (`''`), so the default DESC never reaches the
 * URL and only the non-default `asc` does.
 */
export function ticketListSortToParams(sort: TicketListSort): { sortDir: string } {
  return { sortDir: sort.direction === 'ASC' ? 'asc' : '' };
}

/**
 * The TICKET header toggles newest-first <-> oldest-first. There is no
 * unsorted state: the table always orders by number (the board position is
 * the board's concern), so the third click has nothing to clear.
 */
export function toggleTicketListSort(current: TicketListSort): TicketListSort {
  return { field: TICKET_NUMBER_SORT_FIELD, direction: current.direction === 'DESC' ? 'ASC' : 'DESC' };
}
