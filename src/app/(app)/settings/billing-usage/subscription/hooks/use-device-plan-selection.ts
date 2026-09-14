'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CatalogOption,
  CatalogProduct,
  DevicePlanMode,
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

// Declared with the rest of the selection model, since the choice is reported
// out of this hook and read elsewhere (see `subscription.types.ts`).
export type { DevicePlanMode } from '../types/subscription.types';

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
): DevicePlanState {
  const activePackage = subscriptionProduct?.packageOptions.find(opt => opt.status === 'ACTIVE') ?? null;
  const committedQuantity = activePackage?.quantity ?? null;
  // A committed package IS the prepaid plan, so land on the tab that can show
  // it; everything else (trial, pay-as-you-go, no plan) starts on monthly.
  const mode: DevicePlanMode =
    committedQuantity != null && catalog.annualOption ? 'ANNUAL' : catalog.paygOption ? 'PAYG' : 'ANNUAL';

  // The already-committed count, or the floor. It used to seed from the devices
  // found in the instance; that count is no longer fetched here (see `PaywallCopy`).
  return {
    mode,
    quantity: Math.max(committedQuantity ?? 0, catalog.minAnnualDevices),
  };
}

export function useDevicePlanSelection({ product, subscriptionProduct, onUpdatesChange }: UseDevicePlanSelectionArgs) {
  const catalog = useMemo(() => buildDevicePlanCatalog(product), [product]);

  const [state, setState] = useState<DevicePlanState>(() => buildInitialDevicePlan(catalog, subscriptionProduct));

  // Re-seed when the catalog or the current subscription is replaced. Done during
  // render rather than in an effect: the picker is a priced control, and an effect
  // renders it once against the previous plan's numbers before correcting them.
  const [lastInputs, setLastInputs] = useState({ catalog, subscriptionProduct });
  if (catalog !== lastInputs.catalog || subscriptionProduct !== lastInputs.subscriptionProduct) {
    setLastInputs({ catalog, subscriptionProduct });
    setState(buildInitialDevicePlan(catalog, subscriptionProduct));
  }

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

  // Pay as you go prices no total: it bills the devices actually under
  // management, and that count is no longer fetched here (see `PaywallCopy`).
  // Nothing is guessed in its place — an "estimated total" built from the
  // minimum would understate every fleet larger than the floor.
  //
  // Both rates are per device per month; a prepaid year is × 12. One rate for the
  // whole fleet — quantity buys more devices, never a cheaper device.
  const annualTotal = catalog.annualUnitPrice != null ? quantity * catalog.annualUnitPrice * 12 : null;

  const quantityTooSmall = quantity < catalog.minAnnualDevices;
  const quantityNotDivisible = quantity % unitSize !== 0;
  const valid = mode === 'PAYG' || (quantity > 0 && !quantityTooSmall && !quantityNotDivisible);

  const onUpdatesChangeRef = useRef(onUpdatesChange);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    onUpdatesChangeRef.current = onUpdatesChange;
  });

  // Primitive deps only: the effect calls back into the parent, which re-renders
  // this card, so a freshly-built object in the dependency list would loop.
  useEffect(() => {
    // Nothing to submit while the catalog is loading, and reporting an empty
    // selection would flicker the footer total to "nothing selected".
    if (!product) return;

    // Only the annual commitment has a total to state up front; a metered month
    // has none until it is invoiced.
    const total: SelectionTotal | null =
      mode === 'ANNUAL' && annualTotal != null && valid ? { amount: annualTotal, period: 'year', prepaid: true } : null;

    onUpdatesChangeRef.current({
      mode,
      packageUpdates: valid ? diffPackageUpdates(product, selection, subscriptionProduct) : [],
      checkout: buildCheckoutProduct(product, selection),
      valid,
      total,
    });
  }, [product, subscriptionProduct, selection, mode, annualTotal, valid]);

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
    annualTotal,
    quantityTooSmall,
    quantityNotDivisible,
    setMode,
    setQuantity,
    commitQuantity,
  };
}
