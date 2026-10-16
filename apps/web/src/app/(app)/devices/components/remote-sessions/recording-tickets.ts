import { graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type { recordingTickets_ticket$key as RecordingTicketRef } from '@/__generated__/recordingTickets_ticket.graphql';

// The Assigned Tickets table of the recording page: the tickets linked to the
// session, as the table reads them.

/** A linked ticket as the table reads it, spread in the read and in both mutation payloads. */
const recordingTicketFragment = graphql`
  fragment recordingTickets_ticket on RemoteSessionTicketLink @inline {
    ticketId
    ticketNumber
    title
    statusName
    statusKind
    statusColor
    assignedName
  }
`;

/** One row of the Assigned Tickets table. */
export interface RecordingTicket {
  /** The raw ticket id: what the ticket page opens on and what assign / unassign send. */
  id: string;
  ticketNumber: number | null;
  title: string;
  statusName: string | null;
  statusKind: string | null;
  statusColor: string | null;
  /** Null when nobody is assigned. */
  assignedName: string | null;
}

export function toRecordingTicket(ref: RecordingTicketRef): RecordingTicket {
  const ticket = readInlineData(recordingTicketFragment, ref);
  return {
    id: ticket.ticketId,
    ticketNumber: ticket.ticketNumber ?? null,
    title: ticket.title || 'Untitled Ticket',
    statusName: ticket.statusName ?? null,
    statusKind: ticket.statusKind ?? null,
    statusColor: ticket.statusColor ?? null,
    assignedName: ticket.assignedName ?? null,
  };
}

/** The "Search for Tickets" box: a title or a ticket number containing the text. */
export function matchesTicketSearch(ticket: RecordingTicket, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return (
    ticket.title.toLowerCase().includes(query) ||
    (ticket.ticketNumber != null && String(ticket.ticketNumber).includes(query.replace(/^#/, '')))
  );
}
