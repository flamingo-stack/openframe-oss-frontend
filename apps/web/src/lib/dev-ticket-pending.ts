/**
 * Whether a dev ticket in the URL is still waiting for its exchange.
 *
 * A leaf, because both the session check and the exchange read it. Until the
 * exchange hands over the bearer there is no credential to ask `/me` with, so
 * asking only produces a 401 and a refresh that 401s too, on every ticket
 * landing. The session check holds while this is true; the exchange re-asks it
 * when it answers, success or failure.
 */

/** The ticket whose exchange has answered, either way. A ticket is spent by its one exchange. */
let settledTicket: string | null = null;

export function markDevTicketSettled(ticket: string): void {
  settledTicket = ticket;
}

export function isDevTicketExchangePending(): boolean {
  if (typeof window === 'undefined') return false;
  const ticket = new URLSearchParams(window.location.search).get('devTicket');
  return !!ticket && ticket !== settledTicket;
}
