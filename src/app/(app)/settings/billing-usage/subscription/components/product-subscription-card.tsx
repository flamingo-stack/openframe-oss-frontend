'use client';

import { QuestionCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  RadioGroupBlock,
  Skeleton,
  TabSelector,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { productSubscriptionCardProductFragment$key } from '@/__generated__/productSubscriptionCardProductFragment.graphql';
import type { productSubscriptionCardSubscriptionFragment$key } from '@/__generated__/productSubscriptionCardSubscriptionFragment.graphql';
import { useProductSelection } from '../hooks/use-product-selection';
import type { ProductUpdates } from '../types/subscription.types';
import { buildPackageRadioOptions } from '../utils/build-package-radio-options';
import { PAYG_OPTION_ID } from '../utils/subscription.utils';

export const productSubscriptionCardProductFragment = graphql`
  fragment productSubscriptionCardProductFragment on Product {
    id
    name
    unitSize
    packageOptions {
      id
      billingPeriod
      name
      priceTiers { from upTo unitPrice }
    }
    payAsYouGoOption {
      id
      name
      description
      price
    }
  }
`;

export const productSubscriptionCardSubscriptionFragment = graphql`
  fragment productSubscriptionCardSubscriptionFragment on SubscriptionProductDetail {
    paygOnly
    packageOptions {
      id
      packageOptionId
      billingPeriod
      quantity
      status
    }
    payAsYouGoOption { id packageOptionId }
  }
`;

interface ProductSubscriptionCardProps {
  /** `null` renders the card's loading state — see the component docblock. */
  productRef: productSubscriptionCardProductFragment$key | null;
  subscriptionProductRef: productSubscriptionCardSubscriptionFragment$key | null;
  title: string;
  /**
   * Static text, or a builder receiving the selected billing-period label
   * ("monthly" / "yearly") so copy reflects the chosen package type.
   */
  description: string | ((periodLabel: string) => string);
  packageUnitLabel: string;
  helpText?: ReactNode;
  /**
   * Reserve vertical space for the billing-period toggle even when this card
   * has none, so cards stay aligned when a sibling card shows the toggle.
   */
  reserveBillingPeriodSpace?: boolean;
  onUpdatesChange: (updates: ProductUpdates) => void;
}

/**
 * Click-triggered help popover. A hover Tooltip is wrong for this content: it
 * opens after a delay, dismisses on click, and can't scroll — but the rates
 * panel is interactive and can be long. DropdownMenu opens instantly on click,
 * stays open while interacting, and closes only on outside-click / Escape.
 */
function HelpTooltip({ content }: { content: ReactNode }) {
  const isText = typeof content === 'string';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More information"
          className="shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
        >
          <QuestionCircleIcon className="size-6" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={isText ? 'max-w-xs' : 'p-0 bg-transparent border-0 shadow-none'}
      >
        {content}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A product's package picker: billing period, then a radio list of committed
 * packages.
 *
 * With a `null` productRef it renders its LOADING state — the real card with the
 * catalog-derived rows pending — so the page never has to keep a second,
 * skeleton-shaped copy of this markup in sync with this one.
 */
export function ProductSubscriptionCard({
  productRef,
  subscriptionProductRef,
  title,
  description,
  packageUnitLabel,
  helpText,
  reserveBillingPeriodSpace = false,
  onUpdatesChange,
}: ProductSubscriptionCardProps) {
  const product = useFragment(productSubscriptionCardProductFragment, productRef) ?? null;
  const subscriptionProduct = useFragment(productSubscriptionCardSubscriptionFragment, subscriptionProductRef) ?? null;

  const {
    selection,
    billingPeriodItems,
    tiers,
    baselineUnitPrice,
    months,
    periodSuffix,
    setBillingPeriod,
    setSelectedPackage,
  } = useProductSelection({ product, subscriptionProduct, onUpdatesChange });

  const loading = product == null;

  // The pay-as-you-go row's LABEL is fixed copy; only the rate under it comes
  // from the catalog. So the wait shows that row for real, with the rate pending,
  // rather than a stack of grey bars where the options will be.
  const radioOptions = loading
    ? [{ value: PAYG_OPTION_ID, label: 'Pay as you go', description: <Skeleton className="h-4 w-44" /> }]
    : buildPackageRadioOptions({
        tiers,
        baselineUnitPrice,
        months,
        periodSuffix,
        packageUnitLabel,
        payAsYouGoOption: product.payAsYouGoOption ?? null,
      });

  // "MONTHLY" → "monthly" / "YEARLY" → "yearly", so period-aware copy matches
  // the selected package type.
  const periodLabel = selection.billingPeriod.toLowerCase();
  const resolvedDescription = typeof description === 'function' ? description(periodLabel) : description;

  return (
    <Card
      className="relative flex flex-1 flex-col gap-6 p-6 bg-ods-bg border-ods-border"
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-h2 text-ods-text-primary">{title}</h2>
        {helpText && <HelpTooltip content={helpText} />}
      </div>

      <p className="text-h4 text-ods-text-primary">{resolvedDescription}</p>

      {billingPeriodItems.length > 1 ? (
        <TabSelector
          value={selection.billingPeriod}
          onValueChange={setBillingPeriod}
          variant="primary"
          items={billingPeriodItems}
        />
      ) : (
        // Match the TabSelector's h-12 so cards align when a sibling shows the
        // toggle. Only needed in the lg side-by-side layout; below that the cards
        // stack, so the spacer is hidden to avoid an empty gap.
        reserveBillingPeriodSpace && <div aria-hidden className="hidden h-12 lg:block" />
      )}

      <div className="flex flex-col gap-2 w-full">
        <p className="text-h5 text-ods-text-secondary">Packages</p>
        <div className="flex w-full flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
          <RadioGroupBlock
            name={`packages-${product?.id ?? 'pending'}`}
            variant="grouped"
            disabled={loading}
            value={selection.selectedPackageId ?? ''}
            onValueChange={setSelectedPackage}
            options={radioOptions}
            className="[&>div]:!rounded-none [&>div]:!border-0"
          />
        </div>
      </div>
    </Card>
  );
}
