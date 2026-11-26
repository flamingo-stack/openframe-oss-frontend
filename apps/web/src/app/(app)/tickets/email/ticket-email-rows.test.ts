import { describe, expect, it } from 'vitest';
import type { TicketEmail } from './ticket-email-query';
import { ticketEmailRows } from './ticket-email-rows';

const FROM_EMAIL: TicketEmail = {
  id: 't1',
  emailOrigin: { mailboxAddress: 'support@acme.test', senderAddress: 'jane@customer.test', cc: [] },
  requester: null,
  emailReply: null,
  chatReplyAvailable: false,
};

describe('the email rows of Ticket Details', () => {
  it('are none for a ticket not from email, and while the email side is not read', () => {
    expect(ticketEmailRows(null)).toEqual({ person: [], origin: [] });
    expect(ticketEmailRows({ ...FROM_EMAIL, emailOrigin: null })).toEqual({ person: [], origin: [] });
  });

  it('name the sender by address and the mailbox it came through when nobody was matched', () => {
    expect(ticketEmailRows(FROM_EMAIL)).toEqual({
      person: [
        {
          id: 'requester-email',
          label: 'Email',
          value: { text: 'jane@customer.test', href: 'mailto:jane@customer.test' },
        },
      ],
      origin: [{ id: 'created-by', label: 'Created by', value: { text: 'support@acme.test' } }],
    });
  });

  it('add the matched person, linked to their page, and the address they are answered at', () => {
    const { person } = ticketEmailRows({
      ...FROM_EMAIL,
      requester: {
        accountId: 'acc-1',
        name: 'Jane Doe',
        email: 'jane.doe@customer.test',
        matchedAddress: 'jane@customer.test',
        linkedDevices: [],
      },
    });
    expect(person.map(row => row.label)).toEqual(['User', 'Email']);
    expect(person[0].value).toMatchObject({ text: 'Jane Doe', href: '/users/details?id=acc-1' });
    expect(person[1].value).toMatchObject({ text: 'jane@customer.test' });
  });
});
