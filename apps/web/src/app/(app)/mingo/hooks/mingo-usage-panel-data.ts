import type { ChatUsagePanelData, DialogTokenUsage } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { mingoUsageHydratorQuery as MingoUsageHydratorQueryType } from '@/__generated__/mingoUsageHydratorQuery.graphql';
import { aiPurchasedBalanceTone } from '@/lib/ai-balance-tone';

export type CompanyUsage = Pick<ChatUsagePanelData, 'free' | 'balance' | 'companyLoading'>;

/** The panel's company rows, with the purchased balance coloured independently of the free grant. */
export function companyUsageOf(
  subscription: MingoUsageHydratorQueryType['response']['subscription'],
  lowTokens: number,
  loading: boolean,
): CompanyUsage {
  const usage = subscription?.usage;
  if (!usage) return { free: null, balance: null, companyLoading: loading };
  const free = Number(usage.aiTokensFree);
  const freeUsed = Number(usage.aiTokensFreeUsed);
  const tokens = Number(usage.purchasedTokensRemaining);
  return {
    free: { used: freeUsed, total: free },
    balance: { tokens, usd: usage.purchasedTokensRemainingUsd, tone: aiPurchasedBalanceTone(tokens, lowTokens) },
    companyLoading: false,
  };
}

/**
 * The last reply's tokens by kind, when the backend reported the split: the three input parts and the output add up
 * to the counter's figure. Unknown input parts stay unknown together; an already reported output count is kept.
 */
export function breakdownOf(usage: DialogTokenUsage | null): ChatUsagePanelData['breakdown'] {
  if (!usage) return null;
  const { uncachedInputTokensSize: input, cacheReadTokensSize: cacheRead, cacheWriteTokensSize: cacheWrite } = usage;
  if (typeof input !== 'number' || typeof cacheRead !== 'number' || typeof cacheWrite !== 'number') {
    return { input: null, cacheRead: null, cacheWrite: null, output: usage.outputTokensSize };
  }
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
