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

/** Why the agents have stopped: a trial's grant is spent, or a paid plan's grant and its balance both are. */
export type AiPausedReason = 'trial' | 'balance';

/**
 * The agents have stopped answering, and why — `null` while they still can.
 *
 * A trial runs on its grant alone, so spending that is the end of it; a paid
 * plan draws on the purchased balance next and stops only once that is gone
 * too. One rule behind the red bar in the shell, the alert on the billing
 * page and the locked Mingo composer, so the three can never disagree about
 * whether Mingo is listening.
 */
export function aiPausedReason(input: AiBalanceInput, { isTrial }: { isTrial: boolean }): AiPausedReason | null {
  if (!aiFreeTokensExhausted(input)) return null;
  if (isTrial) return 'trial';
  return input.purchasedRemaining <= 0 ? 'balance' : null;
}

export function aiBalanceTone(input: AiBalanceInput): AiBalanceTone {
  if (!aiFreeTokensExhausted(input)) return 'default';
  if (input.purchasedRemaining <= 0) return 'error';
  return input.purchasedRemaining <= AI_BALANCE_LOW_TOKENS ? 'warning' : 'default';
}
