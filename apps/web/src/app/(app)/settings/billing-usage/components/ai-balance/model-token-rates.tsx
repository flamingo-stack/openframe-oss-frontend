'use client';

import {
  ErrorBoundary,
  ModelTokenRates,
  ModelTokenRatesPopover as RatesPopover,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { modelTokenRatesQuery as ModelTokenRatesQueryType } from '@/__generated__/modelTokenRatesQuery.graphql';

const modelTokenRatesQuery = graphql`
  query modelTokenRatesQuery {
    aiModelRates {
      modelName
      displayName
      providerType
      inputTokenRate
      outputTokenRate
    }
  }
`;

interface ModelTokenRatesPopoverProps {
  /**
   * Whether the balance these rates draw on refills itself — the panel's first
   * line on the billing page, where the balance is a standing figure. Left out
   * on the paywall, where there is no balance yet to have that state, and while
   * the arrangement has not been read.
   */
  autoTopUpEnabled?: boolean;
  className?: string;
}

/**
 * The question-mark button that opens the rates, for every card that counts in
 * tokens: the paywall's AI Token Balance card and the billing page's Paid AI
 * Tokens counter. The table, its trigger and every state of it are the shared
 * library's (`ModelTokenRates`, the one the website's pricing page shows too);
 * this file only READS the rates, and keeps that read inside the panel.
 *
 * Two self-contained boundaries, because this is a TOOLTIP: nothing it does may
 * reach the page it is opened from.
 *
 * Suspense — the rates query is fetched lazily on open, so it must not suspend
 * the page-level boundary (that would flash the full-page skeleton).
 *
 * ErrorBoundary — `aiModelRates` is `[AiModelRate!]!`, and a locked workspace has
 * it refused with `SUBSCRIPTION_TRIAL_EXPIRED`. Non-null means the refusal nulls
 * the whole payload, which Relay throws on; unbounded that throw reached the root
 * and took down the paywall — the one screen a locked workspace must be able to
 * use.
 */
export function ModelTokenRatesPopover({ autoTopUpEnabled, className }: ModelTokenRatesPopoverProps) {
  return (
    <RatesPopover triggerClassName={className}>
      <ErrorBoundary fallback={<ModelTokenRates status="error" autoTopUpEnabled={autoTopUpEnabled} />}>
        <Suspense fallback={<ModelTokenRates status="loading" autoTopUpEnabled={autoTopUpEnabled} />}>
          <LoadedModelTokenRates autoTopUpEnabled={autoTopUpEnabled} />
        </Suspense>
      </ErrorBoundary>
    </RatesPopover>
  );
}

function LoadedModelTokenRates({ autoTopUpEnabled }: Pick<ModelTokenRatesPopoverProps, 'autoTopUpEnabled'>) {
  const data = useLazyLoadQuery<ModelTokenRatesQueryType>(
    modelTokenRatesQuery,
    {},
    {
      // Opened from the paywall, which the lock screen shows — so it has to
      // load on a locked workspace too (see `subscription-gate.ts`).
      fetchPolicy: 'store-and-network',
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );
  return <ModelTokenRates rates={data.aiModelRates} autoTopUpEnabled={autoTopUpEnabled} />;
}
