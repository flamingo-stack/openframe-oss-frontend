import type { TicketEmail, TicketEmailReplyUnavailableReason } from './ticket-email-query';

const EMAIL_UNAVAILABLE: Record<TicketEmailReplyUnavailableReason, string> = {
  NO_MAILBOX: 'No support mailbox is connected. Connect one in Settings → Email to ticket.',
  MAILBOX_CANNOT_SEND: "Replies by email are off: nobody has signed in to reply from this ticket's mailbox.",
  NO_RECIPIENT: 'There is no email address to reply to.',
  TICKET_CLOSED: 'The ticket is closed. Reopen it to reply.',
};

/**
 * Reply by Email, said only until the dashboard can send one: `sendTicketReply` is not served yet (contract part C), so
 * an available email reply still has no way out of this page.
 */
const EMAIL_NOT_SENDABLE = 'Replying by email from OpenFrame is not available yet.';

/** What the composer offers and, for a channel it does not, why (contract part C, F64). */
export interface ReplyChannels {
  chat: { available: true } | { available: false; reason: string };
  email: { available: false; reason: string };
}

/** Why Reply in Chat cannot reach the customer: the API says whether, the ticket says why (contract part C, Fields). */
function chatUnavailableReason(email: TicketEmail, closed: boolean): string {
  if (closed) return 'The ticket is closed. Reopen it to chat.';
  if (email.emailOrigin && !email.requester) {
    return 'The sender is not matched to a directory user, so there is no device to chat with.';
  }
  if (email.requester && email.requester.linkedDevices.length === 0) {
    return 'The requester has no device with OpenFrame, so there is no one to chat with.';
  }
  return 'There is no device to chat with.';
}

export function replyChannelsOf(email: TicketEmail, closed: boolean): ReplyChannels {
  const reason = email.emailReply?.unavailableReason;
  return {
    chat: email.chatReplyAvailable
      ? { available: true }
      : { available: false, reason: chatUnavailableReason(email, closed) },
    email: { available: false, reason: reason ? EMAIL_UNAVAILABLE[reason] : EMAIL_NOT_SENDABLE },
  };
}
