'use client';

import { TagPercentIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Skeleton, TabSelector, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { devicePlanPickerProductFragment$key } from '@/__generated__/devicePlanPickerProductFragment.graphql';
import type { devicePlanPickerSubscriptionFragment$key } from '@/__generated__/devicePlanPickerSubscriptionFragment.graphql';
import { BillingRow } from '../../components/billing-section';
import { formatCount, formatCurrency } from '../../lib/format';
import { type DevicePlanMode, useDevicePlanSelection } from '../hooks/use-device-plan-selection';
import type { ProductUpdates } from '../types/subscription.types';
import { QuantityStepper } from './quantity-stepper';

export const devicePlanPickerProductFragment = graphql`
  fragment devicePlanPickerProductFragment on Product {
    id
    name
    unitSize
    packageOptions {
      id
      billingPeriod
      priceTiers { from upTo unitPrice }
    }
    payAsYouGoOption {
      id
      price
      priceTiers { from upTo unitPrice }
    }
  }
`;

export const devicePlanPickerSubscriptionFragment = graphql`
  fragment devicePlanPickerSubscriptionFragment on SubscriptionProductDetail {
    paygOnly
    packageOptions {
      id
      packageOptionId
      billingPeriod
      quantity
      status
    }
  }
`;

interface DevicePlanPickerProps {
  /** `null` renders the picker's loading state — see the component docblock. */
  productRef: devicePlanPickerProductFragment$key | null;
  subscriptionProductRef: devicePlanPickerSubscriptionFragment$key | null;
  onUpdatesChange: (updates: ProductUpdates) => void;
  /** Small print under the panels. The paywall card explains overage here; the modal shows none. */
  footerNote?: ReactNode;
}

/** Price with the cadence trailing in secondary text, as the rows are drawn in Figma. */
function PriceValue({ amount, period }: { amount: number; period: string }) {
  return (
    <>
      {formatCurrency(amount)}
      <span className="text-ods-text-secondary">/ {period}</span>
    </>
  );
}

/**
 * How devices are paid for: monthly pay-as-you-go, or a device count prepaid for
 * a year at the discounted rate.
 *
 * Its own component because two surfaces ask the same question — the paywall's
 * `DeviceManagementCard` and the billing page's Upgrade Plan modal. They differ
 * only in their frame (a card with a heading vs a modal with a footer button),
 * so everything below the frame lives here. A second copy of these panels is
 * exactly what would drift the moment either one is touched.
 *
 * With a `null` productRef it renders its LOADING state, and that is the whole
 * point of accepting one: everything here except the prices is fixed copy, so
 * the wait shows the real controls — period tabs, row labels — with placeholders
 * only where a server figure goes.
 */
export function DevicePlanPicker({
  productRef,
  subscriptionProductRef,
  onUpdatesChange,
  footerNote,
}: DevicePlanPickerProps) {
  const product = useFragment(devicePlanPickerProductFragment, productRef) ?? null;
  const subscriptionProduct = useFragment(devicePlanPickerSubscriptionFragment, subscriptionProductRef) ?? null;

  const {
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
  } = useDevicePlanSelection({ product, subscriptionProduct, onUpdatesChange });

  const loading = product == null;
  // While loading, the toggle is shown (and inert): every catalog this ships with
  // prices both periods, so hiding it would make the frame jump a row on arrival.
  const showTabs = loading || (catalog.paygOption != null && catalog.annualOption != null);
  const minimumMonthlyPrice = catalog.paygUnitPrice != null ? catalog.minDevices * catalog.paygUnitPrice : null;

  const quantityError = quantityTooSmall
    ? `Minimum ${formatCount(catalog.minAnnualDevices)} devices`
    : quantityNotDivisible
      ? `Must be a multiple of ${formatCount(unitSize)} devices`
      : undefined;

  return (
    <>
      {showTabs && (
        <TabSelector
          value={mode}
          onValueChange={value => setMode(value as DevicePlanMode)}
          variant="primary"
          disabled={loading}
          items={[
            { id: 'PAYG', label: 'Monthly' },
            {
              id: 'ANNUAL',
              label: 'Annual',
              badge:
                catalog.discountPercent > 0 ? (
                  <Tag
                    variant="warning"
                    icon={<TagPercentIcon className="size-4" />}
                    label={`-${catalog.discountPercent}%`}
                  />
                ) : undefined,
            },
          ]}
        />
      )}

      <div className="flex w-full flex-col gap-2">
        <p className="text-h5 text-ods-text-secondary">{mode === 'PAYG' ? 'Pay as you go' : 'Number of devices'}</p>

        {mode === 'PAYG' ? (
          <div className="flex w-full flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card">
            <div className="flex flex-col gap-1 border-b border-ods-border p-[var(--spacing-system-mf)]">
              <p className="text-h4 text-ods-text-primary">
                Billed monthly for exactly the devices under management. Scales up automatically.
              </p>
              {/* The floor is a catalog figure, so it holds a line while it loads —
                  otherwise the block grows a sentence under the user's cursor. */}
              {loading ? (
                <Skeleton className="h-4 w-52" />
              ) : (
                catalog.minDevices > 1 &&
                minimumMonthlyPrice != null && (
                  <p className="text-h6 text-ods-text-secondary">
                    {`Minimum ${formatCount(catalog.minDevices)} devices (${formatCurrency(minimumMonthlyPrice)} / month).`}
                  </p>
                )
              )}
            </div>
            {/* No "Devices Detected" and no monthly total: both were computed from
                a `devices()` count this screen no longer fetches (see `PaywallCopy`).
                What is left is the rate itself, which is all the catalog knows —
                a metered month has no total until it is billed anyway.

                A row appears once its figure exists, or while one is on its way —
                never as an empty label for a price this catalog does not have. */}
            {(catalog.paygUnitPrice != null || loading) && (
              <div className="flex flex-col gap-3 p-[var(--spacing-system-mf)]">
                <BillingRow
                  label="Rate per Device"
                  value={
                    catalog.paygUnitPrice != null ? (
                      <PriceValue amount={catalog.paygUnitPrice} period="month" />
                    ) : (
                      // Stand-in for a figure the server has not sent yet, sized to the value it replaces.
                      <Skeleton className="h-5 w-20" />
                    )
                  }
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-4 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
            {catalog.annualUnitPrice != null && (
              <p className="text-h4 text-ods-text-primary">
                {`${formatCurrency(catalog.annualUnitPrice)} per device / month, billed once a year.`}
                {catalog.discountPercent > 0 && ` That's ${catalog.discountPercent}% off the monthly rate.`}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-ods-border bg-ods-bg px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)]">
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-h3 text-ods-text-primary">Devices to include</p>
                <p className="text-h6 text-ods-text-primary">Prepaid for 12 months</p>
              </div>

              <QuantityStepper
                value={quantity}
                min={catalog.minAnnualDevices}
                step={unitSize}
                label="Number of devices"
                error={quantityError}
                onChange={setQuantity}
                // Whatever was typed is clamped into range when editing ends, so
                // the frame cannot be left showing a plan nobody can buy.
                onCommit={commitQuantity}
              />
            </div>

            {annualTotal != null && !quantityError && (
              <BillingRow label="Total" value={<PriceValue amount={annualTotal} period="year" />} />
            )}

            {footerNote && <p className="text-h6 text-ods-text-secondary">{footerNote}</p>}
          </div>
        )}
      </div>
    </>
  );
}
