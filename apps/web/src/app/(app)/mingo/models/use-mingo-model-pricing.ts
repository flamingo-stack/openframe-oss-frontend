'use client';

import { graphql } from 'react-relay';
import type { useMingoModelPricingQuery as UseMingoModelPricingQueryType } from '@/__generated__/useMingoModelPricingQuery.graphql';
import { aiTokenPrice } from '@/app/(app)/settings/billing-usage/components/shared/ai-token-price';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { type AIProvider, OpenframeProduct } from '@/generated/schema-enums';
import { isBillingHidden } from '@/lib/billing-visibility';

const useMingoModelPricingQuery = graphql`
  query useMingoModelPricingQuery($list: Boolean!) {
    aiModelRates @include(if: $list) {
      providerType
      modelName
      inputTokenRate
      outputTokenRate
    }
    billingPlan @include(if: $list) {
      id
      products {
        id
        name
        ...aiTokenPrice_product
      }
    }
    subscription @include(if: $list) {
      id
      products {
        name
        ...aiTokenPrice_subscriptionProduct
      }
    }
  }
`;

/**
 * Reads current billing rates, and the price Billing charges this tenant for OpenFrame tokens, without blocking the
 * model picker. Nothing in the mobile shell, which shows no prices.
 */
export function useMingoModelPricing(enabled: boolean) {
  const shown = enabled && !isBillingHidden();
  const { data } = useNonSuspendingQuery<UseMingoModelPricingQueryType>(
    useMingoModelPricingQuery,
    { list: true },
    shown,
  );
  const rates = shown ? data.aiModelRates : undefined;
  const catalog = data.billingPlan?.products.find(product => product.name === OpenframeProduct.AI_ASSISTANCE);
  const own = data.subscription?.products.find(product => product.name === OpenframeProduct.AI_ASSISTANCE);
  const tokenPrice = shown ? aiTokenPrice(catalog, own) : null;

  return {
    shown,
    rateFor(provider: AIProvider, modelName: string) {
      const rate = rates?.find(candidate => candidate.providerType === provider && candidate.modelName === modelName);
      return rate && { input: rate.inputTokenRate, output: rate.outputTokenRate };
    },
    /** USD for one million OpenFrame tokens; null while Billing states no price. */
    usdPerMillionOpenFrameTokens: tokenPrice == null ? null : tokenPrice * 1_000_000,
  };
}
