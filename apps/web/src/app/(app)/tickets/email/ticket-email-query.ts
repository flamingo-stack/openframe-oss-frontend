// A ticket's email side (email-to-ticket, contract part C), from the ai-agent's `/chat/graphql`. Its own document, not
// fields of GET_TICKET_QUERY: the types exist only where the backend runs email-to-ticket, and the ai-agent refuses a
// whole document that names a field it lacks. Asked for only while the `email-to-ticket` flag is on.

/** Where the ticket came from, who wrote it, and which replies can reach them now. */
export const GET_TICKET_EMAIL_QUERY = `
  query GetTicketEmail($id: ID!) {
    ticket(id: $id) {
      id
      emailOrigin {
        mailboxAddress
        senderAddress
        cc
      }
      requester {
        accountId
        name
        email
        matchedAddress
        linkedDevices {
          machineId
        }
      }
      emailReply {
        available
        unavailableReason
      }
      chatReplyAvailable
    }
  }
`;

export type TicketEmailReplyUnavailableReason = 'NO_MAILBOX' | 'MAILBOX_CANNOT_SEND' | 'NO_RECIPIENT' | 'TICKET_CLOSED';

/** The answer of {@link GET_TICKET_EMAIL_QUERY}. */
export interface TicketEmail {
  id: string;
  /** Null on a ticket not created from email. */
  emailOrigin: { mailboxAddress: string; senderAddress: string; cc: string[] } | null;
  /** The directory user the sender was matched to; null when there is none. */
  requester: {
    /** The raw directory account id: what the Users page opens. */
    accountId: string;
    name: string | null;
    email: string | null;
    /** The address the person is answered at. */
    matchedAddress: string;
    linkedDevices: Array<{ machineId: string }>;
  } | null;
  /** Null for a caller that is not a technician. */
  emailReply: { available: boolean; unavailableReason: TicketEmailReplyUnavailableReason | null } | null;
  chatReplyAvailable: boolean;
}
