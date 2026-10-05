import { graphql, readInlineData } from 'react-relay';
import type { aiTokenPrice_product$key } from '@/__generated__/aiTokenPrice_product.graphql';
import type { aiTokenPrice_subscriptionProduct$key } from '@/__generated__/aiTokenPrice_subscriptionProduct.graphql';
import { BillingPeriod } from '@/generated/schema-enums';

/**
 * Where the catalog keeps the AI product's rate, and what the rate is quoted
 * per.
 *
 * AI is sold in advance — the token bank — so its option is a package with the
 * period `UNLIMITED` (bought once, lasts until spent), and its `price` is empty
 * there just as a device package's is: the entry band of `priceTiers` is the
 * rate. A metered option, when a catalog ever states one, wins because it is
 * the more specific figure. `unitSize` is the block that rate is quoted per —
 * $10.00 per 1,000,000 tokens — and exists only on the catalog product.
 *
 * `@inline`, because the readers are the top-up forms' pricing, plain
 * arithmetic rather than components of their own.
 */
const aiTokenPriceProductFragment = graphql`
  fragment aiTokenPrice_product on Product @inline {
    unitSize
    payAsYouGoOption {
      id
      price
    }
    packageOptions {
      id
      billingPeriod
      price
      priceTiers {
        unitPrice
      }
    }
  }
`;

/**
 * The subscription's own record of the product: a negotiated rate stated here
 * is what this tenant is actually billed, and wins over the catalog's.
 */
const aiTokenPriceSubscriptionProductFragment = graphql`
  fragment aiTokenPrice_subscriptionProduct on SubscriptionProductDetail @inline {
    payAsYouGoOption {
      id
      price
    }
    packageOptions {
      id
      billingPeriod
      price
    }
  }
`;

interface RateOption {
  readonly billingPeriod?: string | null;
  readonly price?: number | null;
  readonly priceTiers?: readonly { readonly unitPrice: number }[] | null;
}

interface RateProduct {
  readonly payAsYouGoOption?: { readonly price?: number | null } | null;
  readonly packageOptions: readonly RateOption[];
}

/** The rate per block a product states, or `null` when it states none. */
function unitPriceOf(product: RateProduct | null): number | null {
  if (!product) return null;
  const bank = product.packageOptions.find(option => option.billingPeriod === BillingPeriod.UNLIMITED);
  return product.payAsYouGoOption?.price ?? bank?.price ?? bank?.priceTiers?.[0]?.unitPrice ?? null;
}

/**
 * What ONE AI token costs.
 *
 * The catalog prices a UNIT, never a token: multiplying a token count by the
 * rate directly is what printed "~$20,000,000.00" under a 2M-token limit.
 *
 * Returns `null` when either half is missing, and deliberately does NOT fall
 * back to a unit size of 1: that fallback IS the bug above, silently priced a
 * million times over. Callers read `null` as "rate unknown" and show no figure
 * rather than a wrong one.
 */
export function aiTokenPrice(
  catalogRef: aiTokenPrice_product$key | null | undefined,
  subscriptionRef: aiTokenPrice_subscriptionProduct$key | null | undefined = null,
): number | null {
  if (!catalogRef) return null;
  const catalog = readInlineData(aiTokenPriceProductFragment, catalogRef);
  const own = subscriptionRef ? readInlineData(aiTokenPriceSubscriptionProductFragment, subscriptionRef) : null;

  const unitPrice = unitPriceOf(own) ?? unitPriceOf(catalog);
  if (unitPrice == null) return null;
  // GraphQL `Long` arrives as a string or a number depending on its size.
  const size = Number(catalog.unitSize ?? 0);
  if (!Number.isFinite(size) || size <= 0) return null;
  return unitPrice / size;
}

/**
 * How many tokens `amountUsd` buys at `tokenPrice` ($ per token, from
 * {@link aiTokenPrice}); `null` when either is unknown.
 *
 * An estimate for the tiles ("$20 → 2M tokens"), priced at the entry rate: the
 * catalog can state price bands, and the backend quotes the exact quantity at
 * purchase, so the figure here is not what is charged — the invoice is.
 */
export function tokensForUsd(amountUsd: number, tokenPrice: number | null): number | null {
  if (tokenPrice == null || tokenPrice <= 0) return null;
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
  return Math.floor(amountUsd / tokenPrice);
}
