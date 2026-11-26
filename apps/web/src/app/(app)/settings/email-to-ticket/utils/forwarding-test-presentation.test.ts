import { describe, expect, it } from 'vitest';
import {
  ForwardingTestCheckKind,
  ForwardingTestCheckResult,
  ForwardingTestFailureReason,
  ForwardingTestState,
} from '@/generated/schema-enums';
import {
  type FailedTest,
  forwardingTestButtonLabel,
  forwardingTestFailure,
  forwardingTestTag,
} from './forwarding-test-presentation';

const CHECKS_NOTHING_BACK = [
  { kind: ForwardingTestCheckKind.SENT, result: ForwardingTestCheckResult.PASSED },
  { kind: ForwardingTestCheckKind.CAME_BACK, result: ForwardingTestCheckResult.FAILED },
  { kind: ForwardingTestCheckKind.ORIGINAL_SENDER_KEPT, result: ForwardingTestCheckResult.UNKNOWN },
];

function failed(test: Partial<FailedTest>): FailedTest {
  return { failureReason: null, ndrStatus: null, evidence: null, checks: CHECKS_NOTHING_BACK, ...test };
}

describe('forwardingTestTag', () => {
  it('has no tag before the first run and one per run state after it', () => {
    expect(forwardingTestTag(ForwardingTestState.IDLE)).toBeNull();
    expect(forwardingTestTag(ForwardingTestState.WAITING)).toEqual({
      label: 'Waiting for the test email',
      tone: 'waiting',
    });
    expect(forwardingTestTag(ForwardingTestState.PASSED)?.tone).toBe('success');
    expect(forwardingTestTag(ForwardingTestState.FAILED)?.tone).toBe('error');
    expect(forwardingTestTag('SOMETHING_NEW')).toBeNull();
  });
});

describe('forwardingTestButtonLabel', () => {
  it('sends a test first and sends again after', () => {
    expect(forwardingTestButtonLabel(ForwardingTestState.IDLE)).toBe('Send Test Email');
    expect(forwardingTestButtonLabel(ForwardingTestState.FAILED)).toBe('Send Again');
    expect(forwardingTestButtonLabel(ForwardingTestState.PASSED)).toBe('Send Again');
  });
});

describe('forwardingTestFailure', () => {
  it('explains the Microsoft 365 block of outside forwarding', () => {
    const failure = forwardingTestFailure(
      failed({ failureReason: ForwardingTestFailureReason.FORWARDING_BOUNCED, ndrStatus: '5.7.520', evidence: 'x' }),
    );
    expect(failure.title).toBe("The test email didn't come back");
    expect(failure.description).toMatch(/^5\.7\.520: your organisation blocks forwarding/);
  });

  it('quotes the delivery report of any other bounce', () => {
    const failure = forwardingTestFailure(
      failed({
        failureReason: ForwardingTestFailureReason.FORWARDING_BOUNCED,
        ndrStatus: '5.1.1',
        evidence: ' Mailbox does not exist ',
      }),
    );
    expect(failure.description).toBe('5.1.1: Mailbox does not exist');
  });

  it('says tests are stopped when the test email was never sent', () => {
    const failure = forwardingTestFailure(
      failed({
        failureReason: ForwardingTestFailureReason.FORWARDING_BOUNCED,
        evidence: 'Inactive recipient',
        checks: [{ kind: ForwardingTestCheckKind.SENT, result: ForwardingTestCheckResult.FAILED }],
      }),
    );
    expect(failure.description).toMatch(/^Tests to the support address are stopped/);
  });

  it('has a sentence for every failure reason', () => {
    for (const reason of Object.values(ForwardingTestFailureReason)) {
      const failure = forwardingTestFailure(failed({ failureReason: reason }));
      expect(failure.title).not.toBe('');
      expect(failure.description).not.toBe('');
    }
  });
});
