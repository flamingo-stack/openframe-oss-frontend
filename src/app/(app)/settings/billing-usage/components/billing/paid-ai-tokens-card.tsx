'use client';

import { Refresh02VrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { graphql, useFragment } from 'react-relay';
import type { paidAiTokensCard_subscription$key } from '@/__generated__/paidAiTokensCard_subscription.graphql';
import { formatCurrency } from '@/lib/format-currency';
import { formatCompactCount } from '@/lib/format-number';
import type { AutoTopUpStatus } from '../ai-balance/auto-top-up-status';
import { ModelTokenRatesPopover } from '../ai-balance/model-token-rates';
import { aiBalanceState } from '../shared/ai-balance-state';
import { StatEmphasis, UsageStatCard } from '../shared/usage-stat-card';

const paidAiTokensCardFragment = graphql`
  fragment paidAiTokensCard_subscription on SubscriptionDetail {
    ...aiBalanceState_subscription
  }
`;

interface PaidAiTokensCardProps {
  subscription: paidAiTokensCard_subscription$key;
  /**
   * The standing refill arrangement. `null` while it is on its way, when it
   * could not be loaded, and on a trial — which has no balance to refill. The
   * card draws the same either way, minus the mark.
   */
  autoTopUp: AutoTopUpStatus | null;
}

/** The prepaid balance AI draws from once the grant is spent, and what it is worth. */
export function PaidAiTokensCard({ subscription, autoTopUp }: PaidAiTokensCardProps) {
  const ai = aiBalanceState(useFragment(paidAiTokensCardFragment, subscription));

  return (
    <UsageStatCard
      title="Paid AI Tokens"
      tone={ai.paidTone}
      value={
        <>
          {formatCompactCount(ai.paid)}
          {/* The mockup's mark for a balance that refills itself; the popover
              beside it spells the same state out in words. */}
          {autoTopUp?.enabled && (
            <Refresh02VrIcon
              role="img"
              aria-label="Auto top-up enabled"
              className="ml-[var(--spacing-system-xsf)] inline-block size-6 align-middle text-ods-success"
            />
          )}
        </>
      }
      caption={
        <>
          <StatEmphasis>{formatCurrency(ai.paidUsd)}</StatEmphasis> balance
        </>
      }
      trailing={<ModelTokenRatesPopover autoTopUpEnabled={autoTopUp?.enabled} />}
    />
  );
}
