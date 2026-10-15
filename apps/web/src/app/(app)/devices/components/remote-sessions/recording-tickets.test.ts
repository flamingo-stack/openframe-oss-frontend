/**
 * A linked ticket as the table reads it: the raw id it opens and unassigns
 * by, a title even when the ticket has none, and the search box matching a
 * title or a number.
 */
import { describe, expect, it, vi } from 'vitest';
import type { recordingTickets_ticket$key as RecordingTicketRef } from '@/__generated__/recordingTickets_ticket.graphql';
import { matchesTicketSearch, type RecordingTicket, toRecordingTicket } from './recording-tickets';

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const asRef = (link: object) => link as unknown as RecordingTicketRef;

describe('toRecordingTicket', () => {
  it('keeps the raw ticket id and the ticket facts', () => {
    expect(
      toRecordingTicket(
        asRef({
          ticketId: '6ad0a6d1',
          ticketNumber: 1432,
          title: 'Apps and Tools Question',
          statusName: 'Tech Required',
          statusKind: 'TECH_REQUIRED',
          statusColor: '#F5A524',
          assignedName: 'Roman Smith',
        }),
      ),
    ).toEqual({
      id: '6ad0a6d1',
      ticketNumber: 1432,
      title: 'Apps and Tools Question',
      statusName: 'Tech Required',
      statusKind: 'TECH_REQUIRED',
      statusColor: '#F5A524',
      assignedName: 'Roman Smith',
    });
  });

  it('reads a gone ticket as untitled and an unassigned one as nobody', () => {
    expect(
      toRecordingTicket(
        asRef({
          ticketId: '6ad0a6d1',
          ticketNumber: null,
          title: null,
          statusName: null,
          statusKind: null,
          statusColor: null,
          assignedName: null,
        }),
      ),
    ).toMatchObject({ title: 'Untitled Ticket', ticketNumber: null, assignedName: null, statusName: null });
  });
});

describe('matchesTicketSearch', () => {
  const ticket: RecordingTicket = {
    id: 't-1',
    ticketNumber: 3891,
    title: 'Page not found error',
    statusName: null,
    statusKind: null,
    statusColor: null,
    assignedName: null,
  };

  it('matches any ticket while the box is empty', () => {
    expect(matchesTicketSearch(ticket, '')).toBe(true);
    expect(matchesTicketSearch(ticket, '   ')).toBe(true);
  });

  it('matches a part of the title, whatever the case', () => {
    expect(matchesTicketSearch(ticket, 'NOT FOUND')).toBe(true);
    expect(matchesTicketSearch(ticket, 'printer')).toBe(false);
  });

  it('matches the number, with or without its #', () => {
    expect(matchesTicketSearch(ticket, '389')).toBe(true);
    expect(matchesTicketSearch(ticket, '#3891')).toBe(true);
    expect(matchesTicketSearch(ticket, '4000')).toBe(false);
  });
});
