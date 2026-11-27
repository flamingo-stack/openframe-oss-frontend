'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { forwardingTestFailure_test$key } from '@/__generated__/forwardingTestFailure_test.graphql';
import { ForwardingTestCheckKind, ForwardingTestCheckResult } from '@/generated/schema-enums';
import { forwardingTestFailure } from '../../utils/forwarding-test-presentation';

const forwardingTestFailureFragment = graphql`
  fragment forwardingTestFailure_test on ForwardingTest {
    failureReason
    ndrStatus
    evidence
    checks {
      kind
      result
    }
  }
`;

/**
 * Why a run failed (Figma settings 6236-120460). The title is not bold as in Figma: ODS has no bold `text-h6`.
 */
export function ForwardingTestFailure({ test }: { test: forwardingTestFailure_test$key }) {
  const { failureReason, ndrStatus, evidence, checks } = useFragment(forwardingTestFailureFragment, test);
  // The test email never left (Postmark refused it): the SENT check failed.
  const notSent = checks.some(
    ({ kind, result }) => kind === ForwardingTestCheckKind.SENT && result === ForwardingTestCheckResult.FAILED,
  );
  const { title, description } = forwardingTestFailure({ failureReason, ndrStatus, evidence, notSent });
  return (
    <Alert variant="error" className="flex items-start gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
      <span className="shrink-0 pt-[var(--spacing-system-xxs)]">
        <AlertTriangleIcon size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <p className="text-h6">{title}</p>
        <p className="break-words text-h6">{description}</p>
      </div>
    </Alert>
  );
}
