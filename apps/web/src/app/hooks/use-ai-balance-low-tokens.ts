'use client';

import { graphql } from 'react-relay';
import type { useAiBalanceLowTokensQuery as UseAiBalanceLowTokensQueryType } from '@/__generated__/useAiBalanceLowTokensQuery.graphql';
import { AI_BALANCE_LOW_TOKENS, aiBalanceLowTokens } from '@/lib/ai-balance-tone';
import { useFeatureFlagGate } from './use-feature-flag';
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
 * Where "running low" starts for this workspace, for every surface that colours the AI balance: the billing cards, the
 * app-wide bar and Mingo's Usage panel, so they agree.
 *
 * Behind `mingo-chat-usage`: off, the fixed 1M as before, and nothing is asked. On, the Auto Top-Up level
 * (`aiBalanceLowTokens`; the 1M when it cannot be read). Null while the flag or the level is not known yet: a caller
 * passes it on as is (`aiBalanceTone` holds the warning back), so no surface shows a yellow it takes back a moment
 * later. Never suspends.
 */
export function useAiBalanceLowTokens(): number | null {
  const gate = useFeatureFlagGate('mingo-chat-usage');
  const { data, isLoading } = useNonSuspendingQuery<UseAiBalanceLowTokensQueryType>(
    useAiBalanceLowTokensQuery,
    { list: true },
    gate === 'on',
  );
  if (gate === 'loading') return null;
  if (gate === 'off') return AI_BALANCE_LOW_TOKENS;
  return isLoading ? null : aiBalanceLowTokens(data.autoTopUpSettings);
}
