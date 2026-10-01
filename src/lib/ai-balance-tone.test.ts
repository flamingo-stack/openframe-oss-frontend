import { describe, expect, it } from 'vitest';

import { AI_BALANCE_LOW_TOKENS, aiBalanceTone, aiFreeTokensExhausted } from './ai-balance-tone';

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
