/**
 * How an AI spending cap is doing, in the three states every surface that shows
 * it agrees on: the Paid AI Tokens card, the block under it, and the app-wide
 * limit bar.
 *
 * One module because the three are read together — a red card over a yellow bar
 * would be two answers to one question — and because the bar lives in the app
 * shell, which must not import the billing page to find out.
 */
export type AiSpendTone = 'default' | 'warning' | 'error';

/**
 * How much of the cap has to be spent before the app says so.
 *
 * The warning exists to be actionable — early enough to raise the limit before
 * Fae and Mingo stop, late enough that it is not noise on a limit barely
 * touched.
 */
export const AI_CAP_WARNING_RATIO = 0.9;

/**
 * `spendUsd` is the AI overage accrued this period; `capUsd` is the ceiling the
 * customer set, `null` when there is none.
 *
 * No cap means no tone: nothing is being approached, and AI never pauses. A cap
 * of 0 is a real cap — nothing beyond the free tokens — which is why every check
 * here is against `null` and never falsy.
 */
export function aiSpendTone(spendUsd: number, capUsd: number | null): AiSpendTone {
  if (capUsd == null) return 'default';
  if (spendUsd >= capUsd) return 'error';
  return spendUsd >= capUsd * AI_CAP_WARNING_RATIO ? 'warning' : 'default';
}

/** How far into the cap the spend is, 0–100, for copy that states it. */
export function aiSpendPercent(spendUsd: number, capUsd: number | null): number | null {
  if (capUsd == null || capUsd <= 0) return null;
  return Math.min(100, Math.round((spendUsd / capUsd) * 100));
}
