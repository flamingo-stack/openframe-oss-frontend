import { describe, expect, it } from 'vitest';

import { AI_BALANCE_LOW_TOKENS, aiBalanceLowTokens, aiBalanceTone, aiFreeTokensExhausted } from './ai-balance-tone';

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

describe('aiBalanceLowTokens', () => {
  it('is the Auto Top-Up level while Auto Top-Up is on', () => {
    expect(aiBalanceLowTokens({ enabled: true, thresholdTokens: 2_500_000 })).toBe(2_500_000);
  });

  it('is the fixed 1M when Auto Top-Up is off, has no level, or could not be read', () => {
    expect(aiBalanceLowTokens({ enabled: false, thresholdTokens: 2_500_000 })).toBe(AI_BALANCE_LOW_TOKENS);
    expect(aiBalanceLowTokens({ enabled: true, thresholdTokens: null })).toBe(AI_BALANCE_LOW_TOKENS);
    expect(aiBalanceLowTokens(null)).toBe(AI_BALANCE_LOW_TOKENS);
  });

  it('turns the balance yellow at the Auto Top-Up level', () => {
    const lowTokens = aiBalanceLowTokens({ enabled: true, thresholdTokens: 2_500_000 });
    expect(aiBalanceTone({ ...grant, purchasedRemaining: 2_500_001, lowTokens })).toBe('default');
    expect(aiBalanceTone({ ...grant, purchasedRemaining: 2_500_000, lowTokens })).toBe('warning');
    expect(aiBalanceTone({ ...grant, purchasedRemaining: 0, lowTokens })).toBe('error');
  });

  it('holds the yellow back while the level is not known, but still says an empty balance', () => {
    expect(aiBalanceTone({ ...grant, purchasedRemaining: 1, lowTokens: null })).toBe('default');
    expect(aiBalanceTone({ ...grant, purchasedRemaining: 0, lowTokens: null })).toBe('error');
  });
});
