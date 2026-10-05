import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TICKET_LIST_SORT,
  parseTicketListSort,
  ticketListSortToParams,
  toggleTicketListSort,
} from './ticket-list-sort';

const desc = { field: 'ticketNumber', direction: 'DESC' } as const;
const asc = { field: 'ticketNumber', direction: 'ASC' } as const;

describe('toggleTicketListSort', () => {
  it('flips between newest-first and oldest-first', () => {
    expect(toggleTicketListSort(desc)).toEqual(asc);
    expect(toggleTicketListSort(asc)).toEqual(desc);
  });
});

describe('parseTicketListSort', () => {
  it('defaults to newest first for an absent, empty or unknown direction', () => {
    expect(DEFAULT_TICKET_LIST_SORT).toEqual(desc);
    expect(parseTicketListSort('')).toEqual(desc);
    expect(parseTicketListSort('desc')).toEqual(desc);
    expect(parseTicketListSort('title')).toEqual(desc);
  });

  it('reads "asc" as oldest first', () => {
    expect(parseTicketListSort('asc')).toEqual(asc);
  });
});

describe('ticketListSortToParams', () => {
  it('round-trips through parseTicketListSort', () => {
    for (const sort of [desc, asc]) {
      expect(parseTicketListSort(ticketListSortToParams(sort).sortDir)).toEqual(sort);
    }
  });

  it('writes an empty param for the default direction and "asc" otherwise', () => {
    expect(ticketListSortToParams(desc)).toEqual({ sortDir: '' });
    expect(ticketListSortToParams(asc)).toEqual({ sortDir: 'asc' });
  });
});
