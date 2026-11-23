'use client';

import { graphql } from 'react-relay';
import type { useMingoModelPricingQuery as UseMingoModelPricingQueryType } from '@/__generated__/useMingoModelPricingQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import type { AIProvider } from '@/generated/schema-enums';
import { isBillingHidden } from '@/lib/billing-visibility';

const useMingoModelPricingQuery = graphql`
  query useMingoModelPricingQuery($list: Boolean!) {
    aiModelRates @include(if: $list) {
      providerType
      modelName
      inputTokenRate
      outputTokenRate
    }
  }
`;

/** The standard public price for one million OpenFrame tokens. @see https://www.flamingo.run/pricing */
const USD_PER_MILLION_OPENFRAME_TOKENS = 10;

/** Reads current billing rates without blocking the model picker. Nothing in the mobile shell, which shows no prices. */
export function useMingoModelPricing(enabled: boolean) {
  const shown = enabled && !isBillingHidden();
  const { data } = useNonSuspendingQuery<UseMingoModelPricingQueryType>(
    useMingoModelPricingQuery,
    { list: true },
    shown,
  );
  const rates = shown ? data.aiModelRates : undefined;

  return {
    shown,
    rateFor(provider: AIProvider, modelName: string) {
      const rate = rates?.find(candidate => candidate.providerType === provider && candidate.modelName === modelName);
      return rate && { input: rate.inputTokenRate, output: rate.outputTokenRate };
    },
    usdPerMillionOpenFrameTokens: USD_PER_MILLION_OPENFRAME_TOKENS,
  };
}
