'use client';

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DotsLoaderIcon,
  Refresh01LeftIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { forwardingTest_mailbox$key } from '@/__generated__/forwardingTest_mailbox.graphql';
import { ForwardingTestState } from '@/generated/schema-enums';
import {
  type ForwardingTestTone,
  forwardingTestButtonLabel,
  forwardingTestFailure,
  forwardingTestHint,
  forwardingTestTag,
} from '../../utils/forwarding-test-presentation';
import { useForwardingTest } from './use-forwarding-test';

const forwardingTestFragment = graphql`
  fragment forwardingTest_mailbox on Mailbox {
    id
    supportAddress
    lastTest {
      state
      deadlineAt
      failureReason
      ndrStatus
      evidence
      checks {
        kind
        result
      }
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

const TONE_VARIANT = { waiting: 'warning', success: 'success', error: 'error' } as const satisfies Record<
  ForwardingTestTone,
  string
>;

const TONE_ICON: Record<ForwardingTestTone, ReactNode> = {
  waiting: <DotsLoaderIcon size={16} />,
  success: <CheckCircleIcon size={16} />,
  error: <AlertTriangleIcon size={16} />,
};

/**
 * The test row of SET UP FORWARDING (Figma 4527-132336 before a run, 4527-132373 waiting, 4527-132412 failed,
 * 4527-132452 passed): the button, the run's tag, a failed run's cause, and what the test does. Save Mailbox reads the
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
  const tag = forwardingTestTag(lastTest.state);
  const firstRun = lastTest.state === ForwardingTestState.IDLE;
  const failure =
    lastTest.state === ForwardingTestState.FAILED
      ? forwardingTestFailure({
          failureReason: lastTest.failureReason,
          ndrStatus: lastTest.ndrStatus,
          evidence: lastTest.evidence,
          checks: lastTest.checks.map(check => ({ kind: check.kind, result: check.result })),
        })
      : null;

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
        {tag && (
          <Tag
            size="compact"
            variant={TONE_VARIANT[tag.tone]}
            icon={TONE_ICON[tag.tone]}
            label={tag.label}
            role="status"
          />
        )}
      </div>
      {failure && (
        <Alert variant="error" className="flex items-start gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
          <span className="shrink-0 pt-[var(--spacing-system-xxs)]">
            <AlertTriangleIcon size={20} />
          </span>
          <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
            <p className="text-h6">{failure.title}</p>
            <p className="break-words text-h6">{failure.description}</p>
          </div>
        </Alert>
      )}
      <p className="text-ods-text-secondary text-h6">{forwardingTestHint(supportAddress)}</p>
    </div>
  );
}
