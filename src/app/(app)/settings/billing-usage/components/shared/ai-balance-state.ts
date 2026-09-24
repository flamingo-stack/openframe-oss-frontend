import { graphql, readInlineData } from 'react-relay';
import type { aiBalanceState_subscription$key } from '@/__generated__/aiBalanceState_subscription.graphql';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { aiBalanceTone, aiFreeTokensExhausted } from '@/lib/ai-balance-tone';
import type { UsageStatTone } from './usage-stat-card';

/**
 * AI runs on two figures the backend serves itself: the period's free grant,
 * and the prepaid balance it draws from once the grant is spent. Nothing here
 * is derived from an AI package or a spending cap — there is neither.
 *
 * Three surfaces read the pair — the Free and Paid AI Tokens cards and the
 * sentence under them — and they must agree on which one is in trouble, so the
 * reading happens once, here.
 */
const aiBalanceStateFragment = graphql`
  fragment aiBalanceState_subscription on SubscriptionDetail @inline {
    status
    usage {
      aiTokensFree
      aiTokensFreeUsed
      purchasedTokensRemaining
      purchasedTokensRemainingUsd
    }
  }
`;

/** The one sentence the page owes about AI right now, if any. */
export type AiAlert = 'trial-exhausted' | 'low' | 'empty' | null;

export interface AiBalanceState {
  isTrial: boolean;
  /** The period's free grant, and how much of it is gone. */
  free: number;
  freeUsed: number;
  /** Prepaid tokens still in the bank, and what they are worth. */
  paid: number;
  paidUsd: number;
  /** The free card's colour is a trial's: it has no balance to colour. */
  freeTone: UsageStatTone;
  /** The paid card's colour is the balance's state. */
  paidTone: UsageStatTone;
  alert: AiAlert;
}

export function aiBalanceState(ref: aiBalanceState_subscription$key): AiBalanceState {
  const { status, usage } = readInlineData(aiBalanceStateFragment, ref);
  const isTrial = status === SubscriptionStatus.TRIAL;

  // GraphQL `Long` arrives as a string or a number depending on its size.
  const free = Number(usage?.aiTokensFree ?? 0);
  const freeUsed = Number(usage?.aiTokensFreeUsed ?? 0);
  const paid = Number(usage?.purchasedTokensRemaining ?? 0);
  const paidUsd = usage?.purchasedTokensRemainingUsd ?? 0;

  /**
   * Shared with the app-wide balance bar, so the two cannot disagree about when
   * AI is close to stopping (see `lib/ai-balance-tone.ts`).
   *
   * A trial has no balance: it runs on its grant alone, and spending that is
   * the one thing the trial's own card warns about — the paid card stays quiet,
   * and the fix is activation, not a top-up.
   */
  const balanceTone = isTrial ? 'default' : aiBalanceTone({ freeTokens: free, freeUsed, purchasedRemaining: paid });
  const trialExhausted = isTrial && aiFreeTokensExhausted({ freeTokens: free, freeUsed });

  let alert: AiAlert = null;
  if (trialExhausted) alert = 'trial-exhausted';
  else if (balanceTone === 'error') alert = 'empty';
  else if (balanceTone === 'warning') alert = 'low';

  return {
    isTrial,
    free,
    freeUsed,
    paid,
    paidUsd,
    freeTone: trialExhausted ? 'warning' : 'default',
    paidTone: balanceTone,
    alert,
  };
}
