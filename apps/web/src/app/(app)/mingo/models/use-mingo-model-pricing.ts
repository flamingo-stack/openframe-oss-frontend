'use client';

import { graphql } from 'react-relay';
import type { useMingoModelPricingQuery as UseMingoModelPricingQueryType } from '@/__generated__/useMingoModelPricingQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import type { AIProvider } from '@/generated/schema-enums';

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

/** Reads current billing rates without blocking the model picker. */
export function useMingoModelPricing(enabled: boolean) {
  const { data } = useNonSuspendingQuery<UseMingoModelPricingQueryType>(
    useMingoModelPricingQuery,
    { list: true },
    enabled,
  );
  const rates = enabled ? data.aiModelRates : undefined;

  return {
    rateFor(provider: AIProvider, modelName: string) {
      const rate = rates?.find(candidate => candidate.providerType === provider && candidate.modelName === modelName);
      return rate && { input: rate.inputTokenRate, output: rate.outputTokenRate };
    },
    usdPerMillionOpenFrameTokens: USD_PER_MILLION_OPENFRAME_TOKENS,
  };
}
