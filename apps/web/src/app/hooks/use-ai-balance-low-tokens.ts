'use client';

import { graphql } from 'react-relay';
import type { useAiBalanceLowTokensQuery as UseAiBalanceLowTokensQueryType } from '@/__generated__/useAiBalanceLowTokensQuery.graphql';
import { aiBalanceLowTokens } from '@/lib/ai-balance-tone';
import { isBillingHidden } from '@/lib/billing-visibility';
import { useFeatureFlag } from './use-feature-flag';
import { useNonSuspendingQuery } from './use-non-suspending-query';

/**
 * The Auto Top-Up level, on its own: `autoTopUpSettings` is non-null, so an error resolving it would null whatever
 * query carried it, and every surface that colours the balance must keep working without it.
 */
const useAiBalanceLowTokensQuery = graphql`
  query useAiBalanceLowTokensQuery($list: Boolean!) {
    autoTopUpSettings @include(if: $list) {
      enabled
      thresholdTokens
    }
  }
`;

/**
 * Where "running low" starts for this workspace (`aiBalanceLowTokens`), for every surface that colours the AI
 * balance: the billing cards, the app-wide bar and Mingo's Usage panel, so they agree. Never suspends; the fixed 1M
 * until the arrangement is read, and when it cannot be.
 */
export function useAiBalanceLowTokens(enabled = true): number {
  const usageEnabled = useFeatureFlag('mingo-chat-usage') && !isBillingHidden();
  const readEnabled = enabled && usageEnabled;
  const { data } = useNonSuspendingQuery<UseAiBalanceLowTokensQueryType>(
    useAiBalanceLowTokensQuery,
    { list: true },
    readEnabled,
  );
  return aiBalanceLowTokens(readEnabled ? data.autoTopUpSettings : null);
}
