'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { deviceOverageBlock_subscription$key } from '@/__generated__/deviceOverageBlock_subscription.graphql';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { BillingRow } from '../shared/billing-section';
import { deviceAllocation } from '../shared/device-allocation';

const deviceOverageBlockFragment = graphql`
  fragment deviceOverageBlock_subscription on SubscriptionDetail {
    currentPeriodEnd
    cancellationEffectiveAt
    # What the metered surplus has cost so far this period, straight from
    # Stripe's own forecast, in cents. NOT overage times the device rate: that
    # multiplication assumes which rate the surplus is billed at, and the plan's
    # rate is not the metered one the copy below promises.
    currentInvoice {
      estimatedOverage
    }
    ...deviceAllocation_subscription
  }
`;

interface DeviceOverageBlockProps {
  subscription: deviceOverageBlock_subscription$key;
  /** Opens the plan change; `null` on a build that changes nothing. */
  onUpgrade: (() => void) | null;
}

/**
 * One block, one condition: the device count has passed what the plan covers.
 * It states the fact, what it costs, when it will be charged, and puts the fix
 * inside the block rather than making the user hunt for the header button.
 *
 * Only the border and the icon carry the warning colour — the copy stays in the
 * normal text colours, so the block reads as information about the bill rather
 * than an error.
 */
export function DeviceOverageBlock({ subscription, onUpgrade }: DeviceOverageBlockProps) {
  const data = useFragment(deviceOverageBlockFragment, subscription);
  const device = deviceAllocation(data);

  if (!device.overLimit) return null;

  // A cancellation expires pay-as-you-go: devices over the package are blocked
  // from then on, not billed, and there is nothing to upgrade out of. What was
  // metered before it is still on this period's invoice, so that figure stays
  // whenever Stripe has one, with the date it is charged.
  const billed = device.paygActive;
  const invoicedOverage = data.currentInvoice?.estimatedOverage ?? 0;
  const estimatedOverage =
    data.currentInvoice != null && (billed || invoicedOverage > 0) ? invoicedOverage / 100 : null;
  const nextBilling = billed || estimatedOverage != null ? data.currentPeriodEnd : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-ods-warning bg-ods-card">
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
        <div className="flex min-w-[16rem] flex-1 flex-col">
          <p className="font-bold text-ods-text-primary text-h3">You're over your device package limit</p>
          <p className="text-ods-text-secondary text-h4">
            {billed
              ? 'Extra devices will be billed at pay-as-you-go rates, charged separately from your plan.'
              : "Pay-as-you-go is off, so devices added over your package from now on aren't billed. Access is restricted while you're over the limit."}
            {!billed &&
              data.cancellationEffectiveAt &&
              ` Your subscription ends on ${formatDate(data.cancellationEffectiveAt)}.`}
          </p>
        </div>
        {billed && onUpgrade && (
          <Button variant="accent" onClick={onUpgrade}>
            Upgrade Plan
          </Button>
        )}
      </div>
      {/* The plan blocks' rows, as the design has them. Used / Limit is the
          Device Usage card's, right above. */}
      <div className="flex flex-col gap-[var(--spacing-system-sf)] p-[var(--spacing-system-m)]">
        <BillingRow label="Device Overage" value={formatCount(device.overage)} />
        {estimatedOverage != null && <BillingRow label="Overage Payment" value={formatCurrency(estimatedOverage)} />}
        {nextBilling && <BillingRow label="Next Billing" value={formatDate(nextBilling)} />}
      </div>
      {/* After an in-period upgrade the overage is two parts, and the page has to
          add up to the bill: what froze at the upgrade, and what is over the
          allowance since. Both are the backend's figures. */}
      {device.committedOverage > 0 && (
        <p className="border-t border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-ods-text-secondary text-h6">
          {`${formatCount(device.overage)} devices = ${formatCount(device.committedOverage)} frozen at your package upgrade + ${formatCount(device.overage - device.committedOverage)} over the limit`}
        </p>
      )}
    </div>
  );
}
