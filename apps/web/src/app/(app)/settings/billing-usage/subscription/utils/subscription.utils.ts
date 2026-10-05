import type { ProductCheckoutInput } from '../hooks/use-create-checkout-session';
import type { PackageUpdateInput } from '../hooks/use-update-subscription';
import type {
  BillingPeriod,
  CatalogProduct,
  OpenframeProduct,
  ProductSelectionState,
  SubscriptionProductState,
} from '../types/subscription.types';

export const CUSTOM_OPTION_ID = '__custom__';
export const PAYG_OPTION_ID = '__payg__';

// Structural shapes (see subscription.types.ts): every helper here is fed by two
// different Relay fragments, whose generated types are branded and therefore
// mutually unassignable.
type ProductData = CatalogProduct;
type SubscriptionProductData = SubscriptionProductState;

/**
 * The catalog's product name, as the mutation inputs take it.
 *
 * Read back out of Relay data it is widened with `"%future added value"` (see
 * `FromRelay` in the types module), while the INPUT enums carry no such member —
 * a server that adds a product cannot make an old client send one. Narrowed once
 * here rather than at each call site: this name came from the very catalog the
 * input is addressed to, so it is a member by construction.
 */
function inputProductName(product: ProductData): OpenframeProduct {
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
 * fall back to the product's pay-as-you-go option. The fallback matters for
 * products that expose *no* committed `packageOptions` (e.g. AI Assistant, which
 * is catalog-PAYG-only) — without it a valid Custom Amount there resolves to a
 * null id, so the diff/checkout came out empty and the submit button stayed
 * disabled even though the plan-change preview showed a change. With the
 * fallback, Custom Amount behaves like it does for a product that has package
 * options (Devices). Returns null only when the product has neither.
 */
function committedOptionId(product: ProductData, period: BillingPeriod): string | null {
  const option =
    product.packageOptions.find(opt => opt.billingPeriod === period) ??
    product.packageOptions[0] ??
    product.payAsYouGoOption ??
    null;
  return option ? toCatalogOptionId(option.id) : null;
}

/**
 * Backend `quantity`, catalog `priceTier.from`/`upTo`, and the Custom Amount
 * input all speak the same real product count (devices, tokens) — no unit
 * conversion. `unitSize` (devices: 1, AI tokens: 100_000) is only a granularity
 * constraint: the custom quantity must be a positive whole multiple of it.
 * Returns the entered quantity when valid, else null (the UI surfaces a
 * "must be a multiple of N" error in that case).
 */
function validCustomQuantity(product: ProductData, customQuantity: number | null): number | null {
  if (customQuantity == null || customQuantity <= 0) return null;
  const unitSize = Number(product.unitSize ?? 1) || 1;
  if (customQuantity % unitSize !== 0) return null;
  return customQuantity;
}

/**
 * Backend semantics (see `SubscriptionUpdateService.addPackage`):
 * - `ADD` for a product auto-ends the product's currently active package
 *   (sets its endDate to phaseStart - 1). So package swaps within the same
 *   product are a single `ADD` — no explicit `CANCEL` of the previous tier.
 * - PAYG is always-on and self-healed by `reconcilePaygInvariant` on every
 *   `updateSubscription` call. FE never touches PAYG via `PackageUpdateInput`.
 * - `CANCEL` is reserved for removing a product's commitment entirely (e.g.
 *   switching from a committed package to PAYG-only, or turning AI Assistant
 *   off — the latter is handled at the view level, see SubscriptionSettingsView).
 */
export function diffPackageUpdates(
  product: ProductData,
  currentSelection: ProductSelectionState,
  subscriptionProduct: SubscriptionProductData | null,
): PackageUpdateInput[] {
  const activePackage = subscriptionProduct?.packageOptions.find(opt => opt.status === 'ACTIVE') ?? null;
  const activeCancelId = activePackage?.packageOptionId ?? null;
  const activeQuantity = activePackage?.quantity ?? null;

  const wantsPayg = currentSelection.selectedPackageId === PAYG_OPTION_ID;

  if (wantsPayg) {
    return activeCancelId
      ? [{ productName: inputProductName(product), packageOptionId: activeCancelId, action: 'CANCEL' }]
      : [];
  }

  const nextPackageId = committedOptionId(product, currentSelection.billingPeriod);

  let nextQuantity: number | null = null;
  if (currentSelection.selectedPackageId === CUSTOM_OPTION_ID) {
    nextQuantity = validCustomQuantity(product, currentSelection.customQuantity);
  } else if (currentSelection.selectedPackageId) {
    const parsed = Number.parseInt(currentSelection.selectedPackageId, 10);
    nextQuantity = Number.isFinite(parsed) ? parsed : null;
  }

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
  product: ProductData,
  currentSelection: ProductSelectionState,
): ProductCheckoutInput {
  if (currentSelection.selectedPackageId === PAYG_OPTION_ID) {
    return { productName: inputProductName(product), payAsYouGoEnabled: true };
  }

  let quantity: number | null = null;
  if (currentSelection.selectedPackageId === CUSTOM_OPTION_ID) {
    quantity = validCustomQuantity(product, currentSelection.customQuantity);
  } else if (currentSelection.selectedPackageId) {
    const parsed = Number.parseInt(currentSelection.selectedPackageId, 10);
    quantity = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    productName: inputProductName(product),
    packageOptionId: committedOptionId(product, currentSelection.billingPeriod),
    quantity,
    payAsYouGoEnabled: true,
  };
}
