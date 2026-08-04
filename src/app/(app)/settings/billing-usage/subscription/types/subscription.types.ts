import type { BillingPeriod, OpenframeProduct } from '@/__generated__/productSubscriptionCardProductFragment.graphql';
import type { SubscriptionProductStatus } from '@/__generated__/productSubscriptionCardSubscriptionFragment.graphql';
import type { ProductCheckoutInput } from '../hooks/use-create-checkout-session';
import type { PackageUpdateInput } from '../hooks/use-update-subscription';

export type { BillingPeriod } from '@/__generated__/productSubscriptionCardProductFragment.graphql';
export type { SubscriptionProductStatus } from '@/__generated__/productSubscriptionCardSubscriptionFragment.graphql';
export type { OpenframeProduct } from '@/__generated__/subscriptionSettingsViewQuery.graphql';

export type UpdateAction = 'ADD' | 'CANCEL';

/**
 * Structural catalog/subscription shapes the pricing + diff helpers work against.
 *
 * Deliberately NOT the Relay `$data` types: two cards select the same fields
 * through two different fragments (`productSubscriptionCardProductFragment` for
 * the AI card, `deviceManagementCardProductFragment` for the devices card) and
 * generated fragment types are branded with ` $fragmentType`, so they are
 * mutually unassignable. A structural shape is what lets both feed one set of
 * helpers — every Relay type that selects these fields satisfies it.
 */
export interface CatalogPriceTier {
  readonly from: number;
  readonly upTo?: number | null;
  readonly unitPrice: number;
}

export interface CatalogOption {
  readonly id: string;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly billingPeriod?: BillingPeriod | null;
  readonly price?: number | null;
  readonly priceTiers?: readonly CatalogPriceTier[] | null;
}

export interface CatalogProduct {
  readonly name: OpenframeProduct;
  /** GraphQL `Long` — coerce with `Number()` before use. */
  readonly unitSize?: unknown;
  readonly packageOptions: readonly CatalogOption[];
  readonly payAsYouGoOption?: CatalogOption | null;
}

export interface SubscriptionOptionState {
  readonly packageOptionId: string;
  readonly billingPeriod?: BillingPeriod | null;
  readonly quantity?: number | null;
  readonly status?: SubscriptionProductStatus | null;
}

export interface SubscriptionProductState {
  readonly paygOnly: boolean;
  readonly packageOptions: readonly SubscriptionOptionState[];
}

export interface ProductSelectionState {
  payAsYouGoEnabled: boolean;
  billingPeriod: BillingPeriod;
  selectedPackageId: string | null;
  customQuantity: number | null;
}

/** What the current selection costs, for the checkout footer's total line. */
export interface SelectionTotal {
  /** Dollars for one `period`. */
  amount: number;
  /** Cadence `amount` is charged at. */
  period: 'month' | 'year';
  /**
   * True when the amount is charged up front at checkout (prepaid annual), false
   * when it is billed from metered usage after the fact (pay as you go) — the
   * footer must not promise "due today" for money nobody is charged today.
   */
  prepaid: boolean;
}

export interface ProductUpdates {
  /** ADD/CANCEL diff for `updateSubscription` (active paid subscriptions). */
  packageUpdates: PackageUpdateInput[];
  /** Desired end-state for `createCheckoutSession` (TRIAL / TRIAL_EXPIRED / CANCELED). */
  checkout: ProductCheckoutInput;
  /** False when Custom Amount is selected with an empty/invalid quantity. */
  valid: boolean;
  /** Priced selection for the footer total; null when the product has no computable price. */
  total?: SelectionTotal | null;
}
