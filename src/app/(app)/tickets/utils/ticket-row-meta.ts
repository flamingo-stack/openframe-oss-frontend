import { formatTicketRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';

const META_SEPARATOR = ' • ';

/**
 * The secondary line under a ticket title in the ticket tables (Figma tickets
 * 8002-256659): `3891 • 5 min ago`. The number leads so a truncated cell drops
 * the time first, never the number; a missing half is simply left out. The
 * formatter is the board card's, the input is not: the card shows time since
 * the last lifecycle change (`statusUpdatedAt ?? createdAt`), this line the
 * time since creation, which is what the design puts beside the number.
 */
export function formatTicketRowMeta(ticket: { ticketNumber?: number | null; createdAt?: string | null }): string {
  const number = ticket.ticketNumber != null ? String(ticket.ticketNumber) : '';
  const time = ticket.createdAt ? formatTicketRelativeTime(ticket.createdAt) : '';
  return [number, time].filter(Boolean).join(META_SEPARATOR);
}
