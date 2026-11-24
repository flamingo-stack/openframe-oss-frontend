// What a refused mailbox mutation says. The API's `userErrors` carry a stable `code` and the server's message; the
// contract leaves the copy to the PM (Q18), so the codes a person can act on get a sentence here and the rest fall
// back to the server's message.

import { getRelayErrorMessage } from '@/lib/handle-api-error';

interface MailboxUserError {
  readonly code: string;
  readonly message: string;
}

const MAILBOX_ERROR_COPY: Record<string, string> = {
  MAILBOX_EXISTS: 'This address already has a mailbox. Open it from the list instead.',
  MAILBOX_REMOVED: 'This mailbox was disconnected.',
  MAILBOX_NOT_FOUND: 'This mailbox no longer exists.',
  MAILBOX_NOT_PENDING: 'This mailbox is already saved.',
  MAILBOX_PENDING: 'Save this mailbox first.',
  EMAIL_FORWARDING_TEST_NOT_PASSED: 'Forwarding has not passed a test yet: the mailbox can be saved once it does.',
  ORGANIZATION_NOT_FOUND: 'The default customer no longer exists. Pick another one.',
  TICKET_STATUS_NOT_FOUND: 'The default status no longer exists. Pick another one.',
  USER_NOT_FOUND: 'The default assignee no longer exists. Pick another one.',
};

/** The sentence for the first refusal of a mutation's `userErrors`. */
export function mailboxUserErrorMessage(error: MailboxUserError): string {
  return MAILBOX_ERROR_COPY[error.code] ?? (error.message || 'Try again in a moment.');
}

/** The sentence for a mutation that failed as a whole (a top-level GraphQL error, a network failure). */
export function mailboxRequestErrorMessage(error: unknown): string {
  return getRelayErrorMessage(error, 'Try again in a moment.');
}
