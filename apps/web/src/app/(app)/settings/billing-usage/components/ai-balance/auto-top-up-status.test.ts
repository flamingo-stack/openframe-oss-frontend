import { describe, expect, it, vi } from 'vitest';
import type { autoTopUpStatus_settings$key } from '@/__generated__/autoTopUpStatus_settings.graphql';
import { spendLimitUsage, toAutoTopUpStatus } from './auto-top-up-status';

// vitest has no Relay transform: the fragment is the record itself.
vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const settings = (overrides: Record<string, unknown> = {}) =>
  ({
    enabled: true,
    amountUsd: 50,
    thresholdUsd: 10,
    spendLimitUsd: 200,
    spentLast30DaysUsd: 100,
    pausedReason: null,
    resumesAt: null,
    minimumAmountUsd: 10,
    minimumThresholdUsd: 2,
    disabledReason: null,
    paymentMethodSetupUrl: null,
    ...overrides,
  }) as unknown as autoTopUpStatus_settings$key;

describe('toAutoTopUpStatus', () => {
  it('reads the arrangement and the spend over the last 30 days', () => {
    expect(toAutoTopUpStatus(settings())).toMatchObject({
      enabled: true,
      amountUsd: 50,
      thresholdUsd: 10,
      spendLimitUsd: 200,
      spentUsd: 100,
      paused: false,
      minimumAmountUsd: 10,
      minimumThresholdUsd: 2,
    });
  });

  it('is paused only while the limit holds an enabled arrangement back', () => {
    const resumesAt = '2026-11-04T10:00:00Z';
    expect(toAutoTopUpStatus(settings({ pausedReason: 'SPEND_LIMIT_REACHED', resumesAt }))).toMatchObject({
      paused: true,
      resumesAt,
    });
    expect(toAutoTopUpStatus(settings({ enabled: false, pausedReason: 'SPEND_LIMIT_REACHED' })).paused).toBe(false);
  });

  it('falls back to the shared floor when the backend states none', () => {
    expect(toAutoTopUpStatus(settings({ minimumAmountUsd: null, minimumThresholdUsd: null }))).toMatchObject({
      minimumAmountUsd: 10,
      minimumThresholdUsd: 2,
    });
  });
});

describe('spendLimitUsage', () => {
  it('fills the bar toward the limit and marks it reached at the limit', () => {
    expect(spendLimitUsage(100, 200)).toEqual({ percent: 50, reached: false });
    expect(spendLimitUsage(200, 200)).toEqual({ percent: 100, reached: true });
    expect(spendLimitUsage(250, 200)).toEqual({ percent: 100, reached: true });
  });

  it('has nothing to fill without a limit', () => {
    expect(spendLimitUsage(100, null)).toBeNull();
  });
});
