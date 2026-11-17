import { describe, expect, it } from 'vitest';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { breakdownOf, companyUsageOf } from './mingo-usage-panel-data';

const usage = {
  aiTokensFree: 10_000_000,
  aiTokensFreeUsed: 10_000_000,
  purchasedTokensRemaining: 800_000,
  purchasedTokensRemainingUsd: 0.8,
};

describe('companyUsageOf', () => {
  it('reads the grant and the balance, coloured by the workspace low mark', () => {
    expect(companyUsageOf({ id: 's', status: SubscriptionStatus.ACTIVE, usage }, 1_000_000, false)).toEqual({
      free: { used: 10_000_000, total: 10_000_000 },
      balance: { tokens: 800_000, usd: 0.8, tone: 'warning' },
      companyLoading: false,
    });
  });

  it('colours the purchased balance independently of the remaining free grant', () => {
    const subscription = {
      id: 's',
      status: SubscriptionStatus.ACTIVE,
      usage: { ...usage, aiTokensFreeUsed: 0, purchasedTokensRemaining: 0 },
    };
    expect(companyUsageOf(subscription, 1_000_000, false).balance?.tone).toBe('error');
    expect(
      companyUsageOf(
        { ...subscription, usage: { ...subscription.usage, purchasedTokensRemaining: 800_000 } },
        1_000_000,
        false,
      ).balance?.tone,
    ).toBe('warning');
    expect(
      companyUsageOf(
        { ...subscription, usage: { ...subscription.usage, purchasedTokensRemaining: 2_000_000 } },
        1_000_000,
        false,
      ).balance?.tone,
    ).toBe('default');
  });

  it('shows a trial balance independently of its remaining free grant', () => {
    const trial = {
      id: 's',
      status: SubscriptionStatus.TRIAL,
      usage: { ...usage, aiTokensFreeUsed: 0, purchasedTokensRemaining: 0 },
    };
    expect(companyUsageOf(trial, 1_000_000, false).balance?.tone).toBe('error');
    expect(
      companyUsageOf({ ...trial, usage: { ...trial.usage, purchasedTokensRemaining: 800_000 } }, 1_000_000, false)
        .balance?.tone,
    ).toBe('warning');
  });

  it('knows nothing until the usage is read', () => {
    expect(companyUsageOf(undefined, 1_000_000, true)).toEqual({ free: null, balance: null, companyLoading: true });
  });
});

describe('breakdownOf', () => {
  const reply = { inputTokensSize: 11_860, outputTokensSize: 940, totalTokensSize: 12_800, contextSize: 150_000 };

  it('splits the last reply when the backend reported the cache', () => {
    expect(
      breakdownOf({ ...reply, uncachedInputTokensSize: 1_200, cacheReadTokensSize: 10_100, cacheWriteTokensSize: 560 }),
    ).toEqual({ input: 1_200, cacheRead: 10_100, cacheWrite: 560, output: 940 });
  });

  it('keeps known output when the input split is unknown or only partly reported', () => {
    const legacy = { input: null, cacheRead: null, cacheWrite: null, output: 940 };
    expect(breakdownOf(reply)).toEqual(legacy);
    expect(breakdownOf({ ...reply, uncachedInputTokensSize: 1_200, cacheReadTokensSize: null })).toEqual(legacy);
    expect(breakdownOf(null)).toBeNull();
  });
});
