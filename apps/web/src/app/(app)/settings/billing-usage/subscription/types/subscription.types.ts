// From the generated SDL enums, not from a Relay artifact: relay-compiler owns
// `src/__generated__`, re-emits a copy per operation and prunes them, so an
// import of one is stable only until the operation that carried it is renamed —
// which is exactly what happened when the AI package card was removed.
import type { BillingPeriod, OpenframeProduct, SubscriptionProductStatus } from '@/generated/schema-enums';
import type { ProductCheckoutInput } from '../hooks/use-create-checkout-session';
import type { PackageUpdateInput } from '../hooks/use-update-subscription';

export type { BillingPeriod, OpenframeProduct, SubscriptionProductStatus } from '@/generated/schema-enums';

export type UpdateAction = 'ADD' | 'CANCEL';

/**
 * The two ways devices can be paid for, as the design frames them:
 * - `PAYG`   — billed monthly for whatever is under management, nothing committed;
 * - `ANNUAL` — a device count prepaid for 12 months at the discounted yearly rate.
 *
 * They map onto the selection model below (`ProductSelectionState`) as
 * "pay-as-you-go" and "custom quantity on the YEARLY package option", so the
 * update-diff / checkout / comparison helpers are shared between them.
 *
 * Declared here rather than beside the hook that owns the state, because the
 * choice travels: what the AI card gives away for free follows it.
 */
export type DevicePlanMode = 'PAYG' | 'ANNUAL';

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
interface CatalogPriceTier {
  readonly from: number;
  readonly upTo?: number | null;
  readonly unitPrice: number;
}

/**
 * An enum field as it arrives from Relay.
 *
 * relay-compiler widens every schema enum with `"%future added value"` so a
 * server that gains a member cannot break a running client. The structural
 * shapes below are fed straight from that data, so they have to accept it —
 * while still naming the enum they are, which is what the intersection keeps
 * (a bare `string` would lose the autocomplete and say nothing about the field).
 */
type FromRelay<T extends string> = T | (string & {});

export interface CatalogOption {
  readonly id: string;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly billingPeriod?: FromRelay<BillingPeriod> | null;
  readonly price?: number | null;
  readonly priceTiers?: readonly CatalogPriceTier[] | null;
}

export interface CatalogProduct {
  readonly name: FromRelay<OpenframeProduct>;
  /** GraphQL `Long` — coerce with `Number()` before use. */
  readonly unitSize?: unknown;
  readonly packageOptions: readonly CatalogOption[];
  readonly payAsYouGoOption?: CatalogOption | null;
}

interface SubscriptionOptionState {
  readonly packageOptionId: string;
  readonly billingPeriod?: FromRelay<BillingPeriod> | null;
  readonly quantity?: number | null;
  readonly status?: FromRelay<SubscriptionProductStatus> | null;
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
  /** How the devices will be paid for. The AI free-token grant follows it. */
  mode: DevicePlanMode;
  /** ADD/CANCEL diff for `updateSubscription` (active paid subscriptions). */
  packageUpdates: PackageUpdateInput[];
  /** Desired end-state for `createCheckoutSession` (TRIAL / TRIAL_EXPIRED / CANCELED). */
  checkout: ProductCheckoutInput;
  /** False when Custom Amount is selected with an empty/invalid quantity. */
  valid: boolean;
  /** Priced selection for the footer total; null when the product has no computable price. */
  total?: SelectionTotal | null;
}
