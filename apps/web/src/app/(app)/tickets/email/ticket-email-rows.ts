import type { InfoSectionRow } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { routes } from '@/lib/routes';
import type { TicketEmail } from './ticket-email-query';

/** A ticket's email rows in Ticket Details, each group where it goes among the ticket's own rows. */
export interface TicketEmailRows {
  /** After Device: the person who wrote, when the sender matched a directory user, and the address the thread is with. */
  person: InfoSectionRow[];
  /** After Created: the support mailbox the email came in through. */
  origin: InfoSectionRow[];
}

const NO_ROWS: TicketEmailRows = { person: [], origin: [] };

/** Ticket Details of a ticket from email (Figma tickets 8036-36516). None for any other ticket. */
export function ticketEmailRows(email: TicketEmail | null): TicketEmailRows {
  const origin = email?.emailOrigin;
  if (!origin) return NO_ROWS;
  const requester = email.requester;
  const address = requester?.matchedAddress ?? origin.senderAddress;
  return {
    person: [
      ...(requester
        ? [
            {
              id: 'requester',
              label: 'User',
              value: {
                text: requester.name || requester.email || requester.matchedAddress,
                imageFallback: requester.name || requester.matchedAddress,
                href: routes.users.details(requester.accountId),
              },
            },
          ]
        : []),
      { id: 'requester-email', label: 'Email', value: { text: address, href: `mailto:${address}` } },
    ],
    origin: [{ id: 'created-by', label: 'Created by', value: { text: origin.mailboxAddress } }],
  };
}
