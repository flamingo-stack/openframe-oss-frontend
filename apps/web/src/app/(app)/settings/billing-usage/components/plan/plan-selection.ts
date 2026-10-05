import { graphql, readInlineData } from 'react-relay';
import type { activePackage_subscriptionProduct$key } from '@/__generated__/activePackage_subscriptionProduct.graphql';
import type { planSelection_product$key } from '@/__generated__/planSelection_product.graphql';
import type { BillingPeriod, OpenframeProduct } from '@/generated/schema-enums';
import { activePackage } from '../shared/active-package';
import type { ProductCheckoutInput } from './use-create-checkout-session';
import type { PackageUpdateInput } from './use-update-subscription';

/**
 * What the diff and the checkout end-state read of the catalog product: its
 * name (the input is addressed by it), the granularity a quantity must respect,
 * and the option ids a committed quantity attaches to. `@inline`, because the
 * readers below are plain functions called from the picker's hook.
 */
const planSelectionProductFragment = graphql`
  fragment planSelection_product on Product @inline {
    name
    unitSize
    packageOptions {
      id
      billingPeriod
    }
    payAsYouGoOption {
      id
    }
  }
`;

type CatalogProduct = ReturnType<typeof readCatalogProduct>;

function readCatalogProduct(ref: planSelection_product$key) {
  return readInlineData(planSelectionProductFragment, ref);
}

/**
 * The two ways devices can be paid for, as the design frames them:
 * - `PAYG`   — billed monthly for whatever is under management, nothing committed;
 * - `ANNUAL` — a device count prepaid for 12 months at the discounted yearly rate.
 *
 * They map onto the selection model below (`ProductSelectionState`) as
 * "pay-as-you-go" and "custom quantity on the YEARLY package option", so the
 * update-diff and checkout helpers are shared between them.
 */
export type DevicePlanMode = 'PAYG' | 'ANNUAL';

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

export const CUSTOM_OPTION_ID = '__custom__';
export const PAYG_OPTION_ID = '__payg__';

/**
 * The catalog's product name, as the mutation inputs take it.
 *
 * Read back out of Relay data it is widened with `"%future added value"`,
 * while the INPUT enums carry no such member — a server that adds a product
 * cannot make an old client send one. Narrowed once here rather than at each
 * call site: this name came from the very catalog the input is addressed to,
 * so it is a member by construction.
 */
function inputProductName(product: CatalogProduct): OpenframeProduct {
  return product.name as OpenframeProduct;
}

/**
 * Catalog `ProductOption.id` from `billingPlan` is a Relay global id —
 * `base64("ProductOption:<uuid>")`. The backend's `PackageUpdateInput.packageOptionId`
 * expects the raw catalog uuid (the same value `SubscriptionOptionDetail.packageOptionId`
 * returns). Decode the global id; fall back to the input if it isn't encoded.
 */
function toCatalogOptionId(globalId: string): string {
  try {
    const decoded = atob(globalId);
    const idx = decoded.indexOf(':');
    return idx >= 0 ? decoded.slice(idx + 1) : globalId;
  } catch {
    return globalId;
  }
}

/**
 * Catalog `packageOptionId` to attach a committed quantity to for `period`.
 * Prefer the period-matched package option, then the first package option; then
 * fall back to the product's pay-as-you-go option, for a product that exposes
 * no committed `packageOptions` at all. Returns null only when the product has
 * neither.
 */
function committedOptionId(product: CatalogProduct, period: BillingPeriod): string | null {
  const option =
    product.packageOptions.find(opt => opt.billingPeriod === period) ??
    product.packageOptions[0] ??
    product.payAsYouGoOption ??
    null;
  return option ? toCatalogOptionId(option.id) : null;
}

/**
 * Backend `quantity`, catalog `priceTier.from`/`upTo`, and the Custom Amount
 * input all speak the same real product count — no unit conversion. `unitSize`
 * is only a granularity constraint: the custom quantity must be a positive
 * whole multiple of it. Returns the entered quantity when valid, else null (the
 * UI surfaces a "must be a multiple of N" error in that case).
 */
function validCustomQuantity(product: CatalogProduct, customQuantity: number | null): number | null {
  if (customQuantity == null || customQuantity <= 0) return null;
  const unitSize = Number(product.unitSize ?? 1) || 1;
  if (customQuantity % unitSize !== 0) return null;
  return customQuantity;
}

/** The quantity a selection names, whichever way it names it. */
function selectedQuantity(product: CatalogProduct, selection: ProductSelectionState): number | null {
  if (selection.selectedPackageId === CUSTOM_OPTION_ID) {
    return validCustomQuantity(product, selection.customQuantity);
  }
  if (selection.selectedPackageId) {
    const parsed = Number.parseInt(selection.selectedPackageId, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Backend semantics (see `SubscriptionUpdateService.addPackage`):
 * - `ADD` for a product auto-ends the product's currently active package
 *   (sets its endDate to phaseStart - 1). So package swaps within the same
 *   product are a single `ADD` — no explicit `CANCEL` of the previous tier.
 * - PAYG is always-on and self-healed by `reconcilePaygInvariant` on every
 *   `updateSubscription` call. FE never touches PAYG via `PackageUpdateInput`.
 * - `CANCEL` is reserved for removing a product's commitment entirely (e.g.
 *   switching from a committed package to PAYG-only).
 */
export function diffPackageUpdates(
  productRef: planSelection_product$key,
  currentSelection: ProductSelectionState,
  subscriptionProductRef: activePackage_subscriptionProduct$key | null,
): PackageUpdateInput[] {
  const product = readCatalogProduct(productRef);
  // The package in force, read the way every other reader of it reads it.
  const active = subscriptionProductRef == null ? null : activePackage(subscriptionProductRef);
  const activeCancelId = active?.packageOptionId ?? null;
  const activeQuantity = active?.quantity ?? null;

  if (currentSelection.selectedPackageId === PAYG_OPTION_ID) {
    return activeCancelId
      ? [{ productName: inputProductName(product), packageOptionId: activeCancelId, action: 'CANCEL' }]
      : [];
  }

  const nextPackageId = committedOptionId(product, currentSelection.billingPeriod);
  const nextQuantity = selectedQuantity(product, currentSelection);

  if (activeCancelId != null && activeCancelId === nextPackageId && activeQuantity === nextQuantity) {
    return [];
  }

  if (nextPackageId && nextQuantity) {
    return [
      { productName: inputProductName(product), packageOptionId: nextPackageId, action: 'ADD', quantity: nextQuantity },
    ];
  }

  return [];
}

/**
 * Desired end-state for `createCheckoutSession` (used when there is no active
 * paid subscription: TRIAL / TRIAL_EXPIRED / CANCELED). Unlike `diffPackageUpdates`
 * this is not an ADD/CANCEL diff — it describes the target plan for the product.
 */
export function buildCheckoutProduct(
  productRef: planSelection_product$key,
  currentSelection: ProductSelectionState,
): ProductCheckoutInput {
  const product = readCatalogProduct(productRef);
  if (currentSelection.selectedPackageId === PAYG_OPTION_ID) {
    return { productName: inputProductName(product), payAsYouGoEnabled: true };
  }

  // No `payAsYouGoEnabled` on a committed package: the backend decides per
  // product whether the meter runs beyond the allowance, and asking for it on
  // a product sold in advance is refused rather than ignored.
  return {
    productName: inputProductName(product),
    packageOptionId: committedOptionId(product, currentSelection.billingPeriod),
    quantity: selectedQuantity(product, currentSelection),
  };
}
