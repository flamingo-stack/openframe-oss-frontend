import { describe, expect, it } from 'vitest';
import { replyChannelsOf } from './reply-channels';
import type { TicketEmail } from './ticket-email-query';

/** The QA ticket of 2026-11-25: from email, its sender matched to no one, its mailbox not signed in to send. */
const FROM_EMAIL: TicketEmail = {
  id: 't1',
  emailOrigin: { mailboxAddress: 'support@acme.test', senderAddress: 'jane@customer.test', cc: [] },
  requester: null,
  emailReply: { available: false, unavailableReason: 'MAILBOX_CANNOT_SEND' },
  chatReplyAvailable: false,
};

const REQUESTER = {
  name: 'Jane Doe',
  email: 'jane@customer.test',
  matchedAddress: 'jane@customer.test',
  linkedDevices: [{ machineId: 'm1' }],
};

describe('the channels a reply can take', () => {
  it('says why neither reaches an unmatched sender', () => {
    const channels = replyChannelsOf(FROM_EMAIL, false);
    expect(channels.chat).toEqual({
      available: false,
      reason: 'The sender is not matched to a directory user, so there is no device to chat with.',
    });
    expect(channels.email).toEqual({
      available: false,
      reason: "Replies by email are off: nobody has signed in to reply from this ticket's mailbox.",
    });
  });

  it('offers chat when the API says it reaches the requester', () => {
    expect(replyChannelsOf({ ...FROM_EMAIL, requester: REQUESTER, chatReplyAvailable: true }, false).chat).toEqual({
      available: true,
    });
  });

  it('says a matched requester without a device has no one to chat with', () => {
    const ticket = { ...FROM_EMAIL, requester: { ...REQUESTER, linkedDevices: [] } };
    expect(replyChannelsOf(ticket, false).chat).toMatchObject({
      available: false,
      reason: expect.stringMatching(/no device/),
    });
  });

  it('says a closed ticket is to be reopened first', () => {
    expect(replyChannelsOf(FROM_EMAIL, true).chat).toMatchObject({
      reason: 'The ticket is closed. Reopen it to chat.',
    });
    const closed = { ...FROM_EMAIL, emailReply: { available: false, unavailableReason: 'TICKET_CLOSED' as const } };
    expect(replyChannelsOf(closed, true).email.reason).toBe('The ticket is closed. Reopen it to reply.');
  });

  it('never offers email: the dashboard cannot send one yet', () => {
    const ticket = { ...FROM_EMAIL, emailReply: { available: true, unavailableReason: null } };
    expect(replyChannelsOf(ticket, false).email).toEqual({
      available: false,
      reason: 'Replying by email from OpenFrame is not available yet.',
    });
  });
});
