import type { ChatUsagePanelData, DialogTokenUsage } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { mingoUsageHydratorQuery as MingoUsageHydratorQueryType } from '@/__generated__/mingoUsageHydratorQuery.graphql';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { aiBalanceTone } from '@/lib/ai-balance-tone';

export type CompanyUsage = Pick<ChatUsagePanelData, 'free' | 'balance' | 'companyLoading'>;

/** The panel's company rows from the subscription's usage. A trial has no balance to colour (as on the billing page). */
export function companyUsageOf(
  subscription: MingoUsageHydratorQueryType['response']['subscription'],
  lowTokens: number | null,
  loading: boolean,
): CompanyUsage {
  const usage = subscription?.usage;
  if (!usage) return { free: null, balance: null, companyLoading: loading };
  const free = Number(usage.aiTokensFree);
  const freeUsed = Number(usage.aiTokensFreeUsed);
  const tokens = Number(usage.purchasedTokensRemaining);
  const tone =
    subscription.status === SubscriptionStatus.TRIAL
      ? 'default'
      : aiBalanceTone({ freeTokens: free, freeUsed, purchasedRemaining: tokens, lowTokens });
  return {
    free: { used: freeUsed, total: free },
    balance: { tokens, usd: usage.purchasedTokensRemainingUsd, tone },
    companyLoading: false,
  };
}

/**
 * The last reply's tokens by kind, when the backend reported the split: the three input parts and the output add up
 * to the counter's figure. Without the split there is no breakdown, never a guessed one (all of it as Input).
 */
export function breakdownOf(usage: DialogTokenUsage | null): ChatUsagePanelData['breakdown'] {
  if (!usage) return null;
  const { uncachedInputTokensSize: input, cacheReadTokensSize: cacheRead, cacheWriteTokensSize: cacheWrite } = usage;
  if (typeof input !== 'number' || typeof cacheRead !== 'number' || typeof cacheWrite !== 'number') return null;
  return { input, cacheRead, cacheWrite, output: usage.outputTokensSize };
}

/** Nothing read yet: the company rows draw skeletons, the breakdown dashes. */
export const UNREAD_COMPANY_USAGE: CompanyUsage = { free: null, balance: null, companyLoading: true };

/**
 * The Usage panel behind Mingo's token counter: the company rows (`MingoUsageHydrator`) and the open dialog's split
 * and compaction ratio. The counter itself supplies the chat's figures, so the panel and the counter never disagree.
 */
export function buildUsagePanel(company: CompanyUsage, dialogTokenUsage: DialogTokenUsage | null): ChatUsagePanelData {
  return {
    ...company,
    context: { used: null, limit: null, compactionThreshold: dialogTokenUsage?.compactionThreshold ?? null },
    breakdown: breakdownOf(dialogTokenUsage),
  };
}
