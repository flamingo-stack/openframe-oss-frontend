'use client';

import { Refresh01LeftIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { forwardingTest_mailbox$key } from '@/__generated__/forwardingTest_mailbox.graphql';
import { ForwardingTestState } from '@/generated/schema-enums';
import { forwardingTestButtonLabel, forwardingTestHint } from '../../utils/forwarding-test-presentation';
import { ForwardingTestFailure } from './forwarding-test-failure';
import { ForwardingTestTag } from './forwarding-test-tag';
import { useForwardingTest } from './use-forwarding-test';

const forwardingTestFragment = graphql`
  fragment forwardingTest_mailbox on Mailbox {
    id
    supportAddress
    lastTest {
      state
      deadlineAt
      ...forwardingTestFailure_test
    }
  }
`;

// Read again while a run waits: the test row reads the run, and Save Mailbox reads the same record.
const forwardingTestPollQuery = graphql`
  query forwardingTestPollQuery($id: ID!) {
    mailbox(id: $id) {
      ...forwardingTest_mailbox
    }
  }
`;

/**
 * The test row of SET UP FORWARDING (Figma settings 6236-120384 before a run, 6236-120421 waiting, 6236-120460 failed,
 * 6236-120500 passed): the button, the run's tag, a failed run's cause, and what the test does. Save Mailbox reads the
 * same run from the store, so it unlocks the moment the run passes.
 */
export function ForwardingTest({
  mailbox,
  disabled = false,
}: {
  mailbox: forwardingTest_mailbox$key;
  disabled?: boolean;
}) {
  const { id, supportAddress, lastTest } = useFragment(forwardingTestFragment, mailbox);
  const { run, isStarting, waiting } = useForwardingTest({
    mailboxId: id,
    pollQuery: forwardingTestPollQuery,
    state: lastTest.state,
    deadlineAt: lastTest.deadlineAt,
  });
  const firstRun = lastTest.state === ForwardingTestState.IDLE;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)]">
        <Button
          variant={firstRun ? 'accent' : 'outline'}
          leftIcon={firstRun ? undefined : <Refresh01LeftIcon className="text-ods-text-secondary" />}
          onClick={run}
          disabled={disabled || waiting || isStarting}
          loading={isStarting}
          className="w-full content-md:w-auto"
        >
          {forwardingTestButtonLabel(lastTest.state)}
        </Button>
        <ForwardingTestTag state={lastTest.state} />
      </div>
      {lastTest.state === ForwardingTestState.FAILED && <ForwardingTestFailure test={lastTest} />}
      <p className="text-ods-text-secondary text-h6">{forwardingTestHint(supportAddress)}</p>
    </div>
  );
}
