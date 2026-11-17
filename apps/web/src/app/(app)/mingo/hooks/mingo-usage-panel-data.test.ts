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

  it('never colours a trial: it has no balance to top up', () => {
    const trial = companyUsageOf({ id: 's', status: SubscriptionStatus.TRIAL, usage }, 1_000_000, false);
    expect(trial.balance?.tone).toBe('default');
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

  it('has no breakdown without the split, rather than all of it as Input', () => {
    expect(breakdownOf(reply)).toBeNull();
    expect(breakdownOf({ ...reply, uncachedInputTokensSize: 1_200, cacheReadTokensSize: null })).toBeNull();
    expect(breakdownOf(null)).toBeNull();
  });
});
