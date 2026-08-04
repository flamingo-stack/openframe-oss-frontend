'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { productSubscriptionCardProductFragment$data } from '@/__generated__/productSubscriptionCardProductFragment.graphql';
import type { productSubscriptionCardSubscriptionFragment$data } from '@/__generated__/productSubscriptionCardSubscriptionFragment.graphql';
import type { BillingPeriod, ProductSelectionState, ProductUpdates } from '../types/subscription.types';
import {
  buildCheckoutProduct,
  buildInitialSelection,
  CUSTOM_OPTION_ID,
  diffPackageUpdates,
  PAYG_OPTION_ID,
  topmostSelectionId,
} from '../utils/subscription.utils';

type ProductData = productSubscriptionCardProductFragment$data;
type SubscriptionProductData = productSubscriptionCardSubscriptionFragment$data;

/** Selection to sit on until the catalog arrives; nothing is reported from it. */
const PENDING_SELECTION: ProductSelectionState = {
  payAsYouGoEnabled: true,
  billingPeriod: 'YEARLY',
  selectedPackageId: PAYG_OPTION_ID,
  customQuantity: null,
};

interface UseProductSelectionArgs {
  /** `null` while the catalog is still loading — the card renders its own frame meanwhile. */
  product: ProductData | null;
  subscriptionProduct: SubscriptionProductData | null;
  onUpdatesChange: (updates: ProductUpdates) => void;
}

export function useProductSelection({ product, subscriptionProduct, onUpdatesChange }: UseProductSelectionArgs) {
  const [selection, setSelection] = useState(() =>
    product ? buildInitialSelection(product, subscriptionProduct) : PENDING_SELECTION,
  );

  useEffect(() => {
    if (!product) return;
    setSelection(buildInitialSelection(product, subscriptionProduct));
  }, [product, subscriptionProduct]);

  const onUpdatesChangeRef = useRef(onUpdatesChange);
  onUpdatesChangeRef.current = onUpdatesChange;

  useEffect(() => {
    // Nothing to submit while the catalog is loading, and reporting an empty
    // selection would flicker the page footer to "nothing selected".
    if (!product) return;
    // customQuantity is the real product count the user typed; unitSize only
    // constrains granularity — it must be a positive multiple of unitSize
    // (devices: 1, AI tokens: 100_000).
    const unitSize = Number(product.unitSize ?? 1) || 1;
    const valid =
      selection.selectedPackageId !== CUSTOM_OPTION_ID ||
      (selection.customQuantity != null && selection.customQuantity > 0 && selection.customQuantity % unitSize === 0);
    onUpdatesChangeRef.current({
      packageUpdates: diffPackageUpdates(product, selection, subscriptionProduct),
      checkout: buildCheckoutProduct(product, selection),
      valid,
    });
  }, [product, subscriptionProduct, selection]);

  const packageOptions = product?.packageOptions;

  const billingPeriodItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { id: string; label: string }[] = [];
    for (const opt of packageOptions ?? []) {
      if (!opt.billingPeriod || seen.has(opt.billingPeriod)) continue;
      seen.add(opt.billingPeriod);
      items.push({ id: opt.billingPeriod, label: opt.name ?? opt.billingPeriod });
    }
    return items;
  }, [packageOptions]);

  const packageOption =
    packageOptions?.find(opt => opt.billingPeriod === selection.billingPeriod) ?? packageOptions?.[0];
  const allTiers = packageOption?.priceTiers ?? [];
  const baselineUnitPrice = allTiers[0]?.unitPrice ?? product?.payAsYouGoOption?.price ?? null;
  const tiers = allTiers.slice(1);
  const isYearly = selection.billingPeriod === 'YEARLY';
  // Granularity for the Custom input (devices: 1, AI tokens: 100_000): the
  // entered real product count must be a whole multiple of unitSize.
  const unitSize = Number(product?.unitSize ?? 1) || 1;

  return {
    selection,
    billingPeriodItems,
    allTiers,
    tiers,
    baselineUnitPrice,
    unitSize,
    months: isYearly ? 12 : 1,
    periodSuffix: isYearly ? '/year' : '/month',
    setBillingPeriod: (period: string) =>
      setSelection(prev => {
        if (!product) return prev;
        const nextPeriod = period as BillingPeriod;
        const topmost = topmostSelectionId(product, nextPeriod);
        return {
          ...prev,
          billingPeriod: nextPeriod,
          selectedPackageId: topmost,
          payAsYouGoEnabled: topmost === PAYG_OPTION_ID,
          customQuantity: topmost === CUSTOM_OPTION_ID ? (prev.customQuantity ?? unitSize) : null,
        };
      }),
    setSelectedPackage: (packageId: string) => {
      const isPayg = packageId === PAYG_OPTION_ID;
      setSelection(prev => ({
        ...prev,
        payAsYouGoEnabled: isPayg,
        selectedPackageId: packageId,
        customQuantity: packageId === CUSTOM_OPTION_ID ? (prev.customQuantity ?? unitSize) : null,
      }));
    },
    setCustomQuantity: (value: string) => {
      const parsed = Number.parseInt(value, 10);
      setSelection(prev => ({
        ...prev,
        customQuantity: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      }));
    },
  };
}
