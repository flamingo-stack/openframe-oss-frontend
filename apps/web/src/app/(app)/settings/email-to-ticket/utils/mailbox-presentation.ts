// Presentation tables for Email to ticket: every enum → label/variant/copy decision of the mailbox screens lives here,
// declared with `satisfies Record<Enum, …>` so a widened enum (after `generate-enums`) stops type-checking until the
// new value has an answer. Read through `presentationFor`: values reach the UI as plain strings, and a backend ahead
// of the SDL is a runtime possibility.

import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ComponentProps } from 'react';
import type { mailboxRow_mailbox$data } from '@/__generated__/mailboxRow_mailbox.graphql';
import type { mailboxSummaryCard_mailbox$data } from '@/__generated__/mailboxSummaryCard_mailbox.graphql';
import { MailboxProvider, MailboxReceivingState, MailboxReplyState } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { formatDateTime } from '@/lib/format-date';

/** The two providers in the order the radio lists them (Figma 4527-132679). */
export const MAILBOX_PROVIDER_ORDER = [MailboxProvider.MICROSOFT_365, MailboxProvider.GOOGLE_WORKSPACE] as const;

interface ProviderCopy {
  /** Second line of the provider radio. */
  radioDescription: string;
  /** The numbered steps of the forwarding card. */
  forwardingSteps: readonly string[];
  /** "Detailed Instruction": the provider's own help page on forwarding (chosen by the PM, 2026-11-20). */
  guideUrl: string | null;
}

// Microsoft's copy is verbatim from Figma (4527-132336). Google's steps are verbatim from the archive page of the same
// file (4527:119476), the only frame that has them until Design moves them over (contract I32).
const PROVIDER_COPY = {
  [MailboxProvider.MICROSOFT_365]: {
    radioDescription: 'An admin sets up forwarding in the Microsoft 365 admin center.',
    forwardingSteps: [
      'Set up forwarding on the mailbox in the Microsoft 365 admin center.',
      'Allow forwarding outside your organisation. Microsoft blocks it by default, and customers get a bounce.',
      "Don't use an Outlook rule. It sends the email from your address, so OpenFrame can't tell who wrote it.",
    ],
    guideUrl:
      'https://learn.microsoft.com/en-us/microsoft-365/admin/email/configure-email-forwarding?view=o365-worldwide',
  },
  [MailboxProvider.GOOGLE_WORKSPACE]: {
    radioDescription: 'Forwarding is set up in Gmail settings, or in Google Admin for a group.',
    forwardingSteps: [
      'In Gmail settings, add this address under Forwarding. OpenFrame confirms Google’s code for you.',
      'Then turn forwarding on with Forward a copy. Adding the address alone forwards nothing.',
      'Forwarding a group or the whole domain? Set it up in Google Admin instead.',
    ],
    guideUrl: 'https://support.google.com/mail/answer/10957',
  },
} satisfies Record<MailboxProvider, ProviderCopy>;

const UNKNOWN_PROVIDER: ProviderCopy = { radioDescription: '', forwardingSteps: [], guideUrl: null };

export interface MailboxProviderPresentation extends ProviderCopy {
  label: string;
  Logo: ReturnType<typeof providerMark>['Logo'];
}

/** Name, brand mark and copy of a mailbox provider; the marks are the directory providers' own (same two values). */
export function mailboxProviderPresentation(provider: string | null | undefined): MailboxProviderPresentation {
  const { label, Logo } = providerMark(provider);
  return { label, Logo, ...(presentationFor(PROVIDER_COPY, provider) ?? UNKNOWN_PROVIDER) };
}

type TagVariant = NonNullable<ComponentProps<typeof Tag>['variant']>;

interface ReceivingPresentation {
  label: string;
  variant: TagVariant;
}

// Status tags of the receiving state (contract part A, S1, D26). PENDING never reaches a list or the details page:
// the setup page is where a Pending mailbox lives.
const RECEIVING_PRESENTATION = {
  [MailboxReceivingState.PENDING]: { label: 'Pending', variant: 'grey' },
  [MailboxReceivingState.RECEIVING]: { label: 'Receiving', variant: 'success' },
  [MailboxReceivingState.QUIET]: { label: 'Quiet', variant: 'warning' },
  [MailboxReceivingState.NOT_RECEIVING]: { label: 'Not receiving', variant: 'error' },
} satisfies Record<MailboxReceivingState, ReceivingPresentation>;

export function receivingStateTag(state: string | null | undefined): ReceivingPresentation {
  return presentationFor(RECEIVING_PRESENTATION, state) ?? { label: state ?? '', variant: 'grey' };
}

/** The receiving filter's options, in the order the states read (the funnel of the STATUS column). */
export const RECEIVING_FILTER_OPTIONS = [
  MailboxReceivingState.RECEIVING,
  MailboxReceivingState.QUIET,
  MailboxReceivingState.NOT_RECEIVING,
].map(state => ({ id: state, label: RECEIVING_PRESENTATION[state].label, value: state }));

/**
 * The line under the receiving tag in the list (Figma 4527-132165): when the last email came, or, NOT RECEIVING, when
 * the test failed (contract part A, Fields). A mailbox that has had no email yet says so.
 */
export function receivingStateLine(
  mailbox: Pick<mailboxRow_mailbox$data, 'receivingState' | 'lastEmailAt' | 'lastFinishedTestAt'>,
): string {
  if (mailbox.receivingState === MailboxReceivingState.NOT_RECEIVING) {
    return mailbox.lastFinishedTestAt ? `Last test failed ${formatRelativeTime(mailbox.lastFinishedTestAt)}` : '';
  }
  return mailbox.lastEmailAt ? `Last email ${formatRelativeTime(mailbox.lastEmailAt)}` : 'No email yet';
}

/**
 * The line under the receiving tag on the details page (Figma 4527-132198, 4631-6716, 4631-6900; contract part A,
 * Fields): the last test's time, with what QUIET and NOT RECEIVING mean beside it.
 */
export function receivingStateDetailLine(
  mailbox: Pick<mailboxSummaryCard_mailbox$data, 'receivingState' | 'lastFinishedTestAt'>,
): string {
  const tested = mailbox.lastFinishedTestAt ? formatDateTime(mailbox.lastFinishedTestAt) : null;
  switch (mailbox.receivingState) {
    case MailboxReceivingState.QUIET:
      return tested ? `Nothing for 3 days · Test passed ${tested}` : 'Nothing for 3 days';
    case MailboxReceivingState.NOT_RECEIVING:
      return tested ? `Last test failed: ${tested}` : 'Last test failed';
    default:
      return tested ? `Last Test: ${tested}` : 'No test yet';
  }
}

/**
 * Whether replies by email can leave through the mailbox, and what to say when they cannot (contract part A, S2, D45).
 * AS_MAILBOX has no status line of its own. The copy is the contract's working text (Q18), not Figma's: Figma still
 * draws "REPLIES FROM OPENFRAME", which D45 removed (the pack's I43).
 */
const REPLY_STATE_LINE = {
  [MailboxReplyState.AS_MAILBOX]: null,
  [MailboxReplyState.NOT_SIGNED_IN]: 'Replies by email are off: sign in to reply from this mailbox',
  [MailboxReplyState.CANNOT_SEND_AS_MAILBOX]:
    'Sign-in stopped working: replies by email are off until someone signs in again',
} satisfies Record<MailboxReplyState, string | null>;

export function replyStateLine(state: string | null | undefined): string | null {
  return presentationFor(REPLY_STATE_LINE, state) ?? null;
}
