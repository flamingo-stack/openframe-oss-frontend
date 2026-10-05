/**
 * The one way a ticket is named in prose and labels: `1003: Email client
 * synchronization issues` (Figma tickets 8482-112154 / 8456-17581 - the Take
 * Over and Reopen modals, reused for Mingo @-mention chips and the ticket page's
 * open-view context). No `#`: the design never prefixes the number. A missing
 * half is left out; with neither, `fallback` (typically the id) is returned.
 */
export function formatTicketRef(
  ticket: { ticketNumber?: number | null; title?: string | null },
  fallback = '',
): string {
  const number = ticket.ticketNumber != null ? String(ticket.ticketNumber) : '';
  const title = ticket.title?.trim() ?? '';
  if (number && title) return `${number}: ${title}`;
  return number || title || fallback;
}
