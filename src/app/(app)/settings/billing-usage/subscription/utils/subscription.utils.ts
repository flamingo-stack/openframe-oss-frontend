import type { ProductCheckoutInput } from '../hooks/use-create-checkout-session';
import type { PackageUpdateInput } from '../hooks/use-update-subscription';
import type {
  BillingPeriod,
  CatalogProduct,
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

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Compact count: 100000000 → "100M", 100000 → "100K", 100 → "100". */
export { formatCompactCount as formatCompact } from '../../lib/format';

/**
 * Topmost selectable radio for a billing period: PAYG sits first when present
 * (any period); otherwise the first tier; otherwise Custom.
 */
export function topmostSelectionId(product: ProductData, period: BillingPeriod): string {
  if (product.payAsYouGoOption) return PAYG_OPTION_ID;
  const periodOption = product.packageOptions.find(o => o.billingPeriod === period) ?? product.packageOptions[0];
  const tiers = periodOption?.priceTiers?.slice(1) ?? [];
  return tiers.length > 0 ? String(tiers[0].from) : CUSTOM_OPTION_ID;
}

export function formatPaygSubtitle(
  option: { description?: string | null; name?: string | null } | null | undefined,
): string {
  if (!option) return '';
  const { description, name } = option;
  if (description && name) return `${description} (${name})`;
  return description ?? name ?? '';
}

export function buildInitialSelection(
  product: ProductData,
  subscriptionProduct: SubscriptionProductData | null,
): ProductSelectionState {
  const activePackage = subscriptionProduct?.packageOptions.find(opt => opt.status === 'ACTIVE');
  const availablePeriods = new Set(product.packageOptions.map(opt => opt.billingPeriod).filter(Boolean));
  const fallbackPeriod = product.packageOptions[0]?.billingPeriod ?? 'YEARLY';
  const desiredPeriod = activePackage?.billingPeriod ?? fallbackPeriod;
  const billingPeriod = (availablePeriods.has(desiredPeriod) ? desiredPeriod : fallbackPeriod) as BillingPeriod;

  const matchingProductOption =
    product.packageOptions.find(opt => opt.billingPeriod === billingPeriod) ?? product.packageOptions[0];
  const tiers = matchingProductOption?.priceTiers?.slice(1) ?? [];
  const activeQuantity = activePackage?.quantity ?? null;
  const matchedTier = activeQuantity != null ? tiers.find(t => t.from === activeQuantity) : null;

  let selectedPackageId: string;
  let customQuantity: number | null = null;
  if (subscriptionProduct?.paygOnly) {
    // Backend says this product only supports PAYG — no tier/custom choice.
    selectedPackageId = PAYG_OPTION_ID;
  } else if (matchedTier) {
    selectedPackageId = String(matchedTier.from);
  } else if (activeQuantity != null) {
    selectedPackageId = CUSTOM_OPTION_ID;
    customQuantity = activeQuantity;
  } else {
    // No active tier/custom package: default to PAYG (current PAYG state, or soft-default for trial/no-plan users).
    selectedPackageId = PAYG_OPTION_ID;
  }

  return {
    payAsYouGoEnabled: selectedPackageId === PAYG_OPTION_ID,
    billingPeriod,
    selectedPackageId,
    customQuantity,
  };
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
    return activeCancelId ? [{ productName: product.name, packageOptionId: activeCancelId, action: 'CANCEL' }] : [];
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
    return [{ productName: product.name, packageOptionId: nextPackageId, action: 'ADD', quantity: nextQuantity }];
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
    return { productName: product.name, payAsYouGoEnabled: true };
  }

  let quantity: number | null = null;
  if (currentSelection.selectedPackageId === CUSTOM_OPTION_ID) {
    quantity = validCustomQuantity(product, currentSelection.customQuantity);
  } else if (currentSelection.selectedPackageId) {
    const parsed = Number.parseInt(currentSelection.selectedPackageId, 10);
    quantity = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    productName: product.name,
    packageOptionId: committedOptionId(product, currentSelection.billingPeriod),
    quantity,
    payAsYouGoEnabled: true,
  };
}
