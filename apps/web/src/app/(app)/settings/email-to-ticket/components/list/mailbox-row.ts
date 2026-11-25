import { graphql, readInlineData } from 'react-relay';
import type { mailboxRow_mailbox$data, mailboxRow_mailbox$key } from '@/__generated__/mailboxRow_mailbox.graphql';
import { routes } from '@/lib/routes';

/** One row of the Mailboxes list, as its cells read it. */
export const mailboxRowFragment = graphql`
  fragment mailboxRow_mailbox on Mailbox @inline {
    id
    supportAddress
    provider
    receivingState
    lastEmailAt
    lastFinishedTestAt
    stats {
      ticketsCreated
    }
  }
`;

export type MailboxRow = Omit<mailboxRow_mailbox$data, ' $fragmentType'>;

export function toMailboxRow(ref: mailboxRow_mailbox$key): MailboxRow {
  const { id, supportAddress, provider, receivingState, lastEmailAt, lastFinishedTestAt, stats } = readInlineData(
    mailboxRowFragment,
    ref,
  );
  return {
    id,
    supportAddress,
    provider,
    receivingState,
    lastEmailAt,
    lastFinishedTestAt,
    stats: { ticketsCreated: stats.ticketsCreated },
  };
}

export const getMailboxRowId = (row: MailboxRow) => row.id;

/** A loading placeholder row carries its `id` alone: nothing to open. */
export const mailboxRowHref = (row: MailboxRow) =>
  row.supportAddress ? routes.settings.emailToTicket.details(row.id) : null;
