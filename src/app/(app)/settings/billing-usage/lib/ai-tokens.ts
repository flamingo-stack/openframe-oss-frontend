/**
 * OpenFrame tokens every workspace gets each billing period at no charge.
 *
 * MOCK — nothing serves this figure yet. `SubscriptionUsage` reports
 * `aiTokensUsed` and nothing else about AI, and the AI product's catalog entry
 * prices consumption without stating what is free, so the allowance the page
 * counts down from is set here.
 *
 * TODO(backend): expose the monthly allowance (on `subscription` or on the AI
 * product) and read it from there — every screen already goes through
 * `deriveAiTokenUsage`, so the swap is this constant and nothing else.
 */
export const MOCK_FREE_AI_TOKENS_PER_MONTH = 10_000_000;

export interface AiTokenUsage {
  /** Tokens consumed this billing period. */
  used: number;
  /** Tokens included at no charge each period. */
  freeAllowance: number;
  /** Free tokens still unspent. What a card labelled "Free AI Tokens" states. */
  freeRemaining: number;
  /** Share of the free allowance spent, 0–100. */
  freePercentUsed: number;
}

/**
 * AI consumption against the free allowance.
 *
 * Deliberately says nothing about a balance: tokens are metered and billed after
 * the fact, never bought up front, so there is no bank to draw down — only what
 * has been used and what is still free.
 */
export function deriveAiTokenUsage(used: number, freeAllowance: number = MOCK_FREE_AI_TOKENS_PER_MONTH): AiTokenUsage {
  const consumed = Math.max(0, used);
  const free = Math.max(0, freeAllowance);

  return {
    used: consumed,
    freeAllowance: free,
    freeRemaining: Math.max(0, free - consumed),
    // Capped at 100: past the allowance the surplus is billed, not blocked, so
    // the share of *free* tokens spent cannot exceed all of them.
    freePercentUsed: free > 0 ? Math.min(100, Math.round((consumed / free) * 100)) : 0,
  };
}
