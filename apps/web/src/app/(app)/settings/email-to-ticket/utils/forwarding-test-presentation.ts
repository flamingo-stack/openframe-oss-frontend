// What a forwarding test run reads as (contract part A, S6, F14, F15): the tag beside the test button, the button's own
// label, and, for a failed run, the alert under them. Tables are keyed by the schema enums with `satisfies`, so a widened
// enum stops type-checking until it has an answer; values reach the UI as plain strings, read through `presentationFor`.

import {
  ForwardingTestCheckKind,
  ForwardingTestCheckResult,
  ForwardingTestFailureReason,
  ForwardingTestState,
} from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

export type ForwardingTestTone = 'waiting' | 'success' | 'error';

interface StatePresentation {
  /** The tag beside the button; IDLE (no run yet) has none. */
  tag: { label: string; tone: ForwardingTestTone } | null;
}

// Labels are the contract's (`ForwardingTestState`), drawn in Figma 4527-132373 / 132412 / 132452.
const STATE_PRESENTATION = {
  [ForwardingTestState.IDLE]: { tag: null },
  [ForwardingTestState.WAITING]: { tag: { label: 'Waiting for the test email', tone: 'waiting' } },
  [ForwardingTestState.PASSED]: { tag: { label: 'Forwarding works', tone: 'success' } },
  [ForwardingTestState.FAILED]: { tag: { label: 'Forwarding failed', tone: 'error' } },
} satisfies Record<ForwardingTestState, StatePresentation>;

export function forwardingTestTag(state: string | null | undefined): StatePresentation['tag'] {
  return presentationFor(STATE_PRESENTATION, state)?.tag ?? null;
}

/** "Send Test Email" before the first run (Figma 4527-132336), "Send Again" once one exists. */
export function forwardingTestButtonLabel(state: string | null | undefined): string {
  return state == null || state === ForwardingTestState.IDLE ? 'Send Test Email' : 'Send Again';
}

/** The hint under the test row (Figma 4527-132336). */
export function forwardingTestHint(supportAddress: string): string {
  return `OpenFrame sends a test email to ${supportAddress} and waits up to a minute for it to come back here.`;
}

export interface FailedTest {
  failureReason: string | null | undefined;
  ndrStatus: string | null | undefined;
  evidence: string | null | undefined;
  checks: ReadonlyArray<{ readonly kind: string; readonly result: string }>;
}

export interface ForwardingTestFailure {
  title: string;
  description: string;
}

const DID_NOT_COME_BACK = "The test email didn't come back";

// Working copy of the contract (`ForwardingTestFailureReason`, Q18: the PM may still change it). The 5.7.520 line is
// Figma's (4527-132412). ORIGINAL_SENDER_LOST has no copy in the contract; this one says what step 3 of the Microsoft
// steps says.
const NDR_COPY: Record<string, string> = {
  '5.7.520':
    '5.7.520: your organisation blocks forwarding to outside addresses. Allow it as in step 2, then test again.',
};

const SUPPRESSED_COPY =
  'Tests to the support address are stopped because an earlier test bounced. Check the address, then test again.';

const REASON_COPY = {
  [ForwardingTestFailureReason.FORWARDING_BOUNCED]: null,
  [ForwardingTestFailureReason.NOTHING_ARRIVED]: {
    title: DID_NOT_COME_BACK,
    description:
      'Nothing arrived within a minute. Forwarding may be off, go to another address, or be blocked for outside addresses by your organisation. Check steps 1 and 2, then test again.',
  },
  [ForwardingTestFailureReason.GOOGLE_CONFIRMED_NO_EMAIL]: {
    title: DID_NOT_COME_BACK,
    description:
      "Google's confirmation code arrived and OpenFrame confirmed it, but no email followed. Turn on Forward a copy in Gmail settings, as in step 2, then test again.",
  },
  [ForwardingTestFailureReason.ORIGINAL_SENDER_LOST]: {
    title: 'The test email came back without its sender',
    description:
      'It was sent on as a new email from your address, so OpenFrame cannot tell who wrote it. Forward the mailbox as in step 1, not with a rule, then test again.',
  },
} satisfies Record<ForwardingTestFailureReason, ForwardingTestFailure | null>;

/** A bounce: the known SMTP status gets its sentence, any other carries the delivery report's own text. */
function bounceFailure({ ndrStatus, evidence, checks }: FailedTest): ForwardingTestFailure {
  // Postmark refused to send at all (406, the support address suppressed after an earlier bounce): the SENT check failed.
  const notSent = checks.some(
    check => check.kind === ForwardingTestCheckKind.SENT && check.result === ForwardingTestCheckResult.FAILED,
  );
  if (notSent) return { title: DID_NOT_COME_BACK, description: SUPPRESSED_COPY };
  const known = ndrStatus ? NDR_COPY[ndrStatus] : undefined;
  if (known) return { title: DID_NOT_COME_BACK, description: known };
  const report = evidence?.trim();
  const description = report
    ? ndrStatus
      ? `${ndrStatus}: ${report}`
      : report
    : 'The test email bounced. Check steps 1 and 2, then test again.';
  return { title: DID_NOT_COME_BACK, description };
}

/** The alert of a FAILED run; a reason newer than the SDL still says the email did not come back. */
export function forwardingTestFailure(test: FailedTest): ForwardingTestFailure {
  if (test.failureReason === ForwardingTestFailureReason.FORWARDING_BOUNCED) return bounceFailure(test);
  return (
    presentationFor(REASON_COPY, test.failureReason) ?? {
      title: DID_NOT_COME_BACK,
      description: 'Check steps 1 and 2, then test again.',
    }
  );
}
