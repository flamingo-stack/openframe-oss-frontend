import { describe, expect, it } from 'vitest';

import { AI_BALANCE_LOW_TOKENS, aiBalanceTone, aiFreeTokensExhausted, aiPausedReason } from './ai-balance-tone';

const grant = { freeTokens: 10_000_000, freeUsed: 10_000_000 };

describe('aiFreeTokensExhausted', () => {
  it('is spent once the used count reaches the grant', () => {
    expect(aiFreeTokensExhausted({ freeTokens: 10, freeUsed: 9 })).toBe(false);
    expect(aiFreeTokensExhausted({ freeTokens: 10, freeUsed: 10 })).toBe(true);
    expect(aiFreeTokensExhausted({ freeTokens: 10, freeUsed: 11 })).toBe(true);
  });
});

describe('aiBalanceTone', () => {
  it('says nothing while the grant lasts, whatever the bank holds', () => {
    expect(aiBalanceTone({ freeTokens: 10, freeUsed: 3, purchasedRemaining: 0 })).toBe('default');
  });

  it('warns at the low mark and errors on an empty bank once the grant is spent', () => {
    expect(aiBalanceTone({ ...grant, purchasedRemaining: AI_BALANCE_LOW_TOKENS + 1 })).toBe('default');
    expect(aiBalanceTone({ ...grant, purchasedRemaining: AI_BALANCE_LOW_TOKENS })).toBe('warning');
    expect(aiBalanceTone({ ...grant, purchasedRemaining: 0 })).toBe('error');
  });
});

describe('aiPausedReason', () => {
  it('is null while the grant lasts, on a trial and on a paid plan alike', () => {
    const live = { freeTokens: 10, freeUsed: 9, purchasedRemaining: 0 };
    expect(aiPausedReason(live, { isTrial: true })).toBeNull();
    expect(aiPausedReason(live, { isTrial: false })).toBeNull();
  });

  it('pauses a trial the moment its grant is spent — a trial has no bank', () => {
    expect(aiPausedReason({ ...grant, purchasedRemaining: 5_000_000 }, { isTrial: true })).toBe('trial');
  });

  it('pauses a paid plan only once the bank is empty too', () => {
    expect(aiPausedReason({ ...grant, purchasedRemaining: 1 }, { isTrial: false })).toBeNull();
    expect(aiPausedReason({ ...grant, purchasedRemaining: 0 }, { isTrial: false })).toBe('balance');
  });

  it('agrees with the red bar: a paid plan is paused exactly when the tone is error', () => {
    for (const purchasedRemaining of [0, 1, AI_BALANCE_LOW_TOKENS, AI_BALANCE_LOW_TOKENS + 1]) {
      const input = { ...grant, purchasedRemaining };
      expect(aiPausedReason(input, { isTrial: false }) === 'balance').toBe(aiBalanceTone(input) === 'error');
    }
  });
});
