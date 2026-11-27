// Where each of a ticket's files came from (chat attachments: `TicketAttachment.source`), from the ai-agent's
// `/chat/graphql`. Its own document, not a field of GET_TICKET_QUERY: the field exists only where the backend runs chat
// attachments, and the ai-agent refuses a whole document that names a field it lacks. Asked for only while the
// `mingo-chat-attachments` flag is on.

/** Each attachment's id and source. */
export const GET_TICKET_ATTACHMENT_SOURCES_QUERY = `
  query GetTicketAttachmentSources($id: ID!) {
    ticket(id: $id) {
      id
      attachments {
        id
        source
      }
    }
  }
`;

/** `TicketAttachmentSource`: sent in a chat, or uploaded to the ticket. */
export type TicketAttachmentSource = 'CHAT' | 'UPLOAD';

/** The answer of {@link GET_TICKET_ATTACHMENT_SOURCES_QUERY}. */
export interface TicketAttachmentSources {
  id: string;
  attachments: Array<{ id: string; source: TicketAttachmentSource }> | null;
}

/** The label a file's row shows beside its size: only a file that came from a chat has one. */
export function ticketAttachmentSourceLabel(source: TicketAttachmentSource | undefined): string | undefined {
  return source === 'CHAT' ? 'Added from chat' : undefined;
}
