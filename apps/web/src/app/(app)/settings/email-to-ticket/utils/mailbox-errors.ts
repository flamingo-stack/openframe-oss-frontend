// What a refused mailbox mutation says. The API's `userErrors` carry a stable `code` and the server's message; the
// contract leaves the copy to the PM (Q18), so the codes a person can act on get a sentence here and the rest fall
// back to the server's message.

import { graphql, readInlineData } from 'react-relay';
import type { mailboxErrors_userError$key } from '@/__generated__/mailboxErrors_userError.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

/** Spread in every mailbox mutation's `userErrors`. */
export const mailboxErrorsUserErrorFragment = graphql`
  fragment mailboxErrors_userError on UserError @inline {
    code
    message
    field
  }
`;

const MAILBOX_ERROR_COPY: Record<string, string> = {
  MAILBOX_EXISTS: 'This address already has a mailbox. Open it from the list instead.',
  MAILBOX_REMOVED: 'This mailbox was disconnected.',
  MAILBOX_NOT_FOUND: 'This mailbox no longer exists.',
  MAILBOX_NOT_PENDING: 'This mailbox is already saved.',
  MAILBOX_PENDING: 'Save this mailbox first.',
  EMAIL_FORWARDING_TEST_NOT_PASSED: 'Forwarding has not passed a test yet: the mailbox can be saved once it does.',
  EMAIL_FORWARDING_TEST_IN_PROGRESS: 'A test email is already on its way. Wait for its result.',
  EMAIL_BLOCK_LIST_INVALID_VALUE: 'This is not an address or a domain that can be blocked.',
  EMAIL_BLOCK_LIST_DUPLICATE: 'This sender is already in the Block list.',
  EMAIL_BLOCK_LIST_ENTRY_NOT_FOUND: 'This sender is no longer in the Block list.',
  ORGANIZATION_NOT_FOUND: 'The default customer no longer exists. Pick another one.',
  TICKET_STATUS_NOT_FOUND: 'The default status no longer exists. Pick another one.',
  USER_NOT_FOUND: 'The default assignee no longer exists. Pick another one.',
};

/** The sentence for the first refusal of a mutation's `userErrors`. */
export function mailboxUserErrorMessage(ref: mailboxErrors_userError$key): string {
  const { code, message } = readInlineData(mailboxErrorsUserErrorFragment, ref);
  return MAILBOX_ERROR_COPY[code] ?? (message || 'Try again in a moment.');
}

/** The input field a refusal points at (`blockList.3`), when it names one. */
export function mailboxUserErrorField(ref: mailboxErrors_userError$key): string | null {
  return readInlineData(mailboxErrorsUserErrorFragment, ref).field ?? null;
}

/** The sentence for a mutation that failed as a whole (a top-level GraphQL error, a network failure). */
export function mailboxRequestErrorMessage(error: unknown): string {
  return getRelayErrorMessage(error, 'Try again in a moment.');
}
