'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CatalogOption,
  CatalogProduct,
  ProductSelectionState,
  ProductUpdates,
  SelectionTotal,
  SubscriptionProductState,
} from '../types/subscription.types';
import {
  buildCheckoutProduct,
  CUSTOM_OPTION_ID,
  diffPackageUpdates,
  PAYG_OPTION_ID,
} from '../utils/subscription.utils';

/**
 * The two ways devices can be paid for, as the design frames them:
 * - `PAYG`   — billed monthly for whatever is under management, nothing committed;
 * - `ANNUAL` — a device count prepaid for 12 months at the discounted yearly rate.
 *
 * They map onto the existing selection model (`ProductSelectionState`) as
 * "pay-as-you-go" and "custom quantity on the YEARLY package option", so the
 * update-diff / checkout / comparison helpers are shared with the other card.
 */
export type DevicePlanMode = 'PAYG' | 'ANNUAL';

/**
 * The smallest fleet a paid plan covers.
 *
 * A product rule, not a catalog one: `priceTiers` start at a single device, so
 * nothing in the billing plan states this floor and deriving it from the tiers
 * yields 1. It lives here as the one place that defines it, and both periods
 * read it — the monthly panel announces it ("Minimum N devices"), the annual
 * stepper refuses to go under it.
 *
 * If the backend ever exposes a per-plan minimum, replace this with that field
 * rather than adding a second floor beside it.
 */
const MINIMUM_MANAGED_DEVICES = 10;

/**
 * Devices are priced by BILLING PERIOD ONLY — one rate per device per month for
 * pay as you go, another for the annual commitment. Quantity does not move the
 * rate, by product decision, so nothing here reads a price tier for a quantity.
 *
 * That is what makes `discountPercent` honest at any fleet size: it compares the
 * two rates the user is actually choosing between, and the comparison holds for
 * 10 devices and for 10,000. A tiered catalog would break that — the announced
 * percentage would only be true at the band it was measured in.
 *
 * `priceTiers` is still where the catalog puts a rate, so the entry band is read
 * as THE rate for the period. A catalog that ever ships more than one band for
 * devices would be silently priced at its first one; that is a backend contract
 * change, and this comment is the note to come back here when it happens.
 */
interface DevicePlanCatalog {
  paygOption: CatalogOption | null;
  annualOption: CatalogOption | null;
  /** $ per device per month, billed monthly by usage. */
  paygUnitPrice: number | null;
  /** $ per device per month on the annual commitment, billed once a year. */
  annualUnitPrice: number | null;
  /** How much cheaper the annual rate is than the monthly one, in whole percent (0 when it isn't). */
  discountPercent: number;
  /** Smallest device count pay-as-you-go sells. */
  minDevices: number;
  /** Smallest device count the annual commitment sells; the stepper's floor. */
  minAnnualDevices: number;
}

interface DevicePlanState {
  mode: DevicePlanMode;
  /** Devices to prepay for in `ANNUAL`; carried across mode switches. */
  quantity: number;
}

interface UseDevicePlanSelectionArgs {
  /** `null` while the catalog is still loading — the card renders its own frame meanwhile. */
  product: CatalogProduct | null;
  subscriptionProduct: SubscriptionProductState | null;
  /** Devices under management right now — the pay-as-you-go billing basis; `null` until counted. */
  detectedDevices: number | null;
  onUpdatesChange: (updates: ProductUpdates) => void;
}

function buildDevicePlanCatalog(product: CatalogProduct | null): DevicePlanCatalog {
  const paygOption = product?.payAsYouGoOption ?? null;
  const annualOption = product?.packageOptions.find(opt => opt.billingPeriod === 'YEARLY') ?? null;
  const annualTiers = annualOption?.priceTiers ?? [];
  // The period's rate, not a band to look a quantity up in — see the interface.
  const annualUnitPrice = annualTiers[0]?.unitPrice ?? null;
  const paygUnitPrice = paygOption?.price ?? null;
  const discountPercent =
    paygUnitPrice != null && paygUnitPrice > 0 && annualUnitPrice != null
      ? Math.max(0, Math.round((1 - annualUnitPrice / paygUnitPrice) * 100))
      : 0;
  // The plan's floor, or a period's own first priced band when the catalog sells
  // from higher up — a yearly catalog starting at 100 devices must not raise what
  // metered monthly billing charges for a 12-device fleet, so the two are read
  // separately rather than shared.
  const minDevices = Math.max(MINIMUM_MANAGED_DEVICES, paygOption?.priceTiers?.[0]?.from ?? 1);
  const minAnnualDevices = Math.max(MINIMUM_MANAGED_DEVICES, annualTiers[0]?.from ?? 1);

  return { paygOption, annualOption, paygUnitPrice, annualUnitPrice, discountPercent, minDevices, minAnnualDevices };
}

function buildInitialDevicePlan(
  catalog: DevicePlanCatalog,
  subscriptionProduct: SubscriptionProductState | null,
  detectedDevices: number | null,
): DevicePlanState {
  const activePackage = subscriptionProduct?.packageOptions.find(opt => opt.status === 'ACTIVE') ?? null;
  const committedQuantity = activePackage?.quantity ?? null;
  // A committed package IS the prepaid plan, so land on the tab that can show
  // it; everything else (trial, pay-as-you-go, no plan) starts on monthly.
  const mode: DevicePlanMode =
    committedQuantity != null && catalog.annualOption ? 'ANNUAL' : catalog.paygOption ? 'PAYG' : 'ANNUAL';

  return {
    mode,
    quantity: Math.max(committedQuantity ?? detectedDevices ?? 0, catalog.minAnnualDevices),
  };
}

export function useDevicePlanSelection({
  product,
  subscriptionProduct,
  detectedDevices,
  onUpdatesChange,
}: UseDevicePlanSelectionArgs) {
  const catalog = useMemo(() => buildDevicePlanCatalog(product), [product]);

  // Read at (re)initialisation only: the detected count is live data that can
  // refetch under the user, and folding it into the reset effect would wipe a
  // half-typed device count every time the number moved.
  const detectedDevicesRef = useRef(detectedDevices);
  detectedDevicesRef.current = detectedDevices;

  const [state, setState] = useState<DevicePlanState>(() =>
    buildInitialDevicePlan(catalog, subscriptionProduct, detectedDevices),
  );

  useEffect(() => {
    setState(buildInitialDevicePlan(catalog, subscriptionProduct, detectedDevicesRef.current));
  }, [catalog, subscriptionProduct]);

  const unitSize = Number(product?.unitSize ?? 1) || 1;
  const { mode, quantity } = state;

  const selection = useMemo<ProductSelectionState>(
    () =>
      mode === 'PAYG'
        ? { payAsYouGoEnabled: true, billingPeriod: 'MONTHLY', selectedPackageId: PAYG_OPTION_ID, customQuantity: null }
        : {
            payAsYouGoEnabled: false,
            billingPeriod: 'YEARLY',
            selectedPackageId: CUSTOM_OPTION_ID,
            customQuantity: quantity,
          },
    [mode, quantity],
  );

  // Pay as you go bills the devices actually under management, never fewer than
  // the catalog's floor — which is exactly what the minimum means.
  const billedDevices = Math.max(detectedDevices ?? 0, catalog.minDevices);
  const paygTotal =
    catalog.paygUnitPrice != null && detectedDevices != null ? billedDevices * catalog.paygUnitPrice : null;

  // Both rates are per device per month; a prepaid year is × 12. One rate for the
  // whole fleet — quantity buys more devices, never a cheaper device.
  const annualTotal = catalog.annualUnitPrice != null ? quantity * catalog.annualUnitPrice * 12 : null;

  const quantityTooSmall = quantity < catalog.minAnnualDevices;
  const quantityNotDivisible = quantity % unitSize !== 0;
  const valid = mode === 'PAYG' || (quantity > 0 && !quantityTooSmall && !quantityNotDivisible);

  const onUpdatesChangeRef = useRef(onUpdatesChange);
  onUpdatesChangeRef.current = onUpdatesChange;

  // Primitive deps only: the effect calls back into the parent, which re-renders
  // this card, so a freshly-built object in the dependency list would loop.
  useEffect(() => {
    // Nothing to submit while the catalog is loading, and reporting an empty
    // selection would flicker the footer total to "nothing selected".
    if (!product) return;

    const total: SelectionTotal | null =
      mode === 'PAYG'
        ? paygTotal != null
          ? { amount: paygTotal, period: 'month', prepaid: false }
          : null
        : annualTotal != null && valid
          ? { amount: annualTotal, period: 'year', prepaid: true }
          : null;

    onUpdatesChangeRef.current({
      packageUpdates: valid ? diffPackageUpdates(product, selection, subscriptionProduct) : [],
      checkout: buildCheckoutProduct(product, selection),
      valid,
      total,
    });
  }, [product, subscriptionProduct, selection, mode, paygTotal, annualTotal, valid]);

  const setMode = useCallback((next: DevicePlanMode) => setState(prev => ({ ...prev, mode: next })), []);

  const setQuantity = useCallback((next: number) => setState(prev => ({ ...prev, quantity: next })), []);

  /**
   * Snap a typed quantity back into range. Called on blur rather than on every
   * keystroke: rewriting the field mid-typing would fight the user (clearing it
   * to type a new number would instantly become "10"), but leaving the field on
   * a value that cannot be bought is not a state to walk away from either.
   */
  const commitQuantity = useCallback(
    () =>
      setState(prev => {
        const rounded = Math.ceil(prev.quantity / unitSize) * unitSize;
        return { ...prev, quantity: Math.max(catalog.minAnnualDevices, rounded) };
      }),
    [catalog.minAnnualDevices, unitSize],
  );

  return {
    catalog,
    mode,
    quantity,
    unitSize,
    paygTotal,
    annualTotal,
    quantityTooSmall,
    quantityNotDivisible,
    setMode,
    setQuantity,
    commitQuantity,
  };
}
