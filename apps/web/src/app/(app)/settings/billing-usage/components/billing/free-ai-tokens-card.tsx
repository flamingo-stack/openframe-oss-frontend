'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { freeAiTokensCard_subscription$key } from '@/__generated__/freeAiTokensCard_subscription.graphql';
import { formatCompactCount } from '@/lib/format-number';
import { aiBalanceState } from '../shared/ai-balance-state';
import { StatSuffix, UsageStatCard } from '../shared/usage-stat-card';

const freeAiTokensCardFragment = graphql`
  fragment freeAiTokensCard_subscription on SubscriptionDetail {
    ...aiBalanceState_subscription
  }
`;

/** The period's free grant, and how much of it is gone. */
export function FreeAiTokensCard({ subscription }: { subscription: freeAiTokensCard_subscription$key | null }) {
  const data = useFragment(freeAiTokensCardFragment, subscription);
  if (useLoadingScope() || data == null) return <UsageStatCard title="Free AI Tokens" loading />;
  const ai = aiBalanceState(data);

  return (
    <UsageStatCard
      title="Free AI Tokens"
      tone={ai.freeTone}
      value={
        <>
          {formatCompactCount(ai.freeUsed)}
          <StatSuffix>/{formatCompactCount(ai.free)}</StatSuffix>
        </>
      }
      caption={ai.isTrial ? 'Included with trial' : 'Updated monthly'}
    />
  );
}
