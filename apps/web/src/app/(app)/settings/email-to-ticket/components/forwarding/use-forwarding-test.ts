'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect } from 'react';
import { fetchQuery, type GraphQLTaggedNode, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useForwardingTestRunMutation as RunMutationType } from '@/__generated__/useForwardingTestRunMutation.graphql';
import { ForwardingTestState } from '@/generated/schema-enums';
import { parseInstant } from '@/lib/graphql-scalars';
import { getRelayErrorCodes } from '@/lib/handle-api-error';
import { sessionPollsAllowed } from '@/lib/session-poll';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';

// The mutation answers the run it started (the test row's fragment); a page that shows more of the mailbox (the
// details card and actions) reads it again with its own poll query while the run waits.
const runMutation = graphql`
  mutation useForwardingTestRunMutation($input: MailboxIdInput!) {
    runForwardingTest(input: $input) {
      mailbox {
        ...forwardingTest_mailbox
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

/** How often a waiting run is read again. The run lasts at most a minute. */
export const FORWARDING_TEST_POLL_MS = 3_000;
/** Past the deadline the server never answers WAITING; this covers a clock skew and a slow answer. */
const DEADLINE_GRACE_MS = 30_000;
/** A run read as WAITING with no deadline (not expected) is still given up after the test's minute and the grace. */
const FALLBACK_RUN_MS = 60_000;

/** Postmark did not take the test email: a top-level error, nothing started (contract part A, errors). */
const SEND_FAILED = 'EMAIL_FORWARDING_TEST_SEND_FAILED';

interface UseForwardingTestArgs {
  mailboxId: string;
  /** A query of this mailbox taking `$id`, read again while the run waits: the caller's, spreading what it shows. */
  pollQuery: GraphQLTaggedNode;
  /** The stored run's state and deadline: a WAITING run is read again until it is not. */
  state: string | null | undefined;
  deadlineAt: string | null | undefined;
}

/**
 * Send Test Email / Send Again / Check Forwarding (contract part A, `runForwardingTest`, S6): starts a run, then reads
 * the mailbox every few seconds while the run waits, up to its deadline. The page that shows the run (its tag, its
 * alert, Save Mailbox) reads it from the store. A run already waiting when the page opens is followed the same way.
 */
export function useForwardingTest({ mailboxId, pollQuery, state, deadlineAt }: UseForwardingTestArgs) {
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const [commit, isStarting] = useMutation<RunMutationType>(runMutation);
  const waiting = state === ForwardingTestState.WAITING;

  useEffect(() => {
    if (!waiting) return undefined;
    const deadline = (deadlineAt ? parseInstant(deadlineAt)?.getTime() : undefined) ?? Date.now() + FALLBACK_RUN_MS;
    const giveUpAt = deadline + DEADLINE_GRACE_MS;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: { unsubscribe: () => void } | undefined;

    const schedule = () => {
      if (stopped || Date.now() > giveUpAt) return;
      timer = setTimeout(read, FORWARDING_TEST_POLL_MS);
    };
    // A paused session (a 401 that survived a refresh, a deleted workspace) is not asked again until it comes back.
    function read() {
      if (stopped) return;
      if (!sessionPollsAllowed()) {
        schedule();
        return;
      }
      request = fetchQuery(environment, pollQuery, { id: mailboxId }, { fetchPolicy: 'network-only' }).subscribe({
        complete: schedule,
        error: schedule,
      });
    }

    schedule();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      request?.unsubscribe();
    };
  }, [waiting, deadlineAt, mailboxId, pollQuery, environment]);

  const run = () => {
    const fail = (description: string) => {
      toast({ title: 'Could not send the test email', description, variant: 'destructive' });
    };
    commit({
      variables: { input: { mailboxId } },
      onCompleted: ({ runForwardingTest: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) fail(mailboxUserErrorMessage(refusal));
      },
      onError: error =>
        fail(
          getRelayErrorCodes(error).includes(SEND_FAILED)
            ? 'The test email could not be sent. Check the mailbox address, then try again.'
            : mailboxRequestErrorMessage(error),
        ),
    });
  };

  return { run, isStarting, waiting };
}
