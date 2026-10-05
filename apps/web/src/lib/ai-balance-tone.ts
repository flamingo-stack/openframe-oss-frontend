/**
 * How the AI token balance is doing, in the three states every surface that
 * shows it agrees on: the Paid AI Tokens card, the block under it, and the
 * app-wide balance bar.
 *
 * One module because the three are read together — a red card over a yellow bar
 * would be two answers to one question — and because the bar lives in the app
 * shell, which must not import the billing page to find out.
 *
 * AI runs on the period's free grant first and on the purchased balance after
 * that, so the balance is only in play once the grant is spent: a bank of zero
 * beside an untouched grant is nothing to warn about.
 */
export type AiBalanceTone = 'default' | 'warning' | 'error';

/**
 * Where "running low" starts, in tokens. The mockups draw the warning at 1M — a
 * few conversations on a premium model — and there is no cap to state it as a
 * share of, so it is a fixed figure rather than a ratio.
 */
export const AI_BALANCE_LOW_TOKENS = 1_000_000;

export interface AiBalanceInput {
  /** The period's free grant and how much of it is spent (`usage.aiTokensFree*`). */
  freeTokens: number;
  freeUsed: number;
  /** Prepaid tokens still available (`usage.purchasedTokensRemaining`). */
  purchasedRemaining: number;
}

/** The grant is spent: from here on, AI draws from the balance or stops. */
export function aiFreeTokensExhausted({
  freeTokens,
  freeUsed,
}: Pick<AiBalanceInput, 'freeTokens' | 'freeUsed'>): boolean {
  return freeUsed >= freeTokens;
}

export function aiBalanceTone(input: AiBalanceInput): AiBalanceTone {
  if (!aiFreeTokensExhausted(input)) return 'default';
  if (input.purchasedRemaining <= 0) return 'error';
  return input.purchasedRemaining <= AI_BALANCE_LOW_TOKENS ? 'warning' : 'default';
}
