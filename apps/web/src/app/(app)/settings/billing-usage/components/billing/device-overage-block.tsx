'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { deviceOverageBlock_subscription$key } from '@/__generated__/deviceOverageBlock_subscription.graphql';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { deviceAllocation } from '../shared/device-allocation';

const deviceOverageBlockFragment = graphql`
  fragment deviceOverageBlock_subscription on SubscriptionDetail {
    currentPeriodEnd
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

/** One figure of an overage, stated above what it counts. */
function OverageStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <p className="text-ods-text-primary text-h4">{value}</p>
      <p className="text-ods-text-secondary text-h6">{label}</p>
    </div>
  );
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

  const estimatedOverage = data.currentInvoice != null ? data.currentInvoice.estimatedOverage / 100 : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-ods-warning bg-ods-card">
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
        <div className="flex min-w-[16rem] flex-1 flex-col">
          <p className="font-bold text-ods-text-primary text-h3">You're over your device package limit</p>
          <p className="text-ods-text-secondary text-h4">
            Extra devices will be billed at pay-as-you-go rates, charged separately from your plan.
          </p>
        </div>
        {onUpgrade && (
          <Button variant="accent" onClick={onUpgrade}>
            Upgrade Plan
          </Button>
        )}
      </div>
      {/* Figure over label, side by side — not the label-dash-value rows of the
          plan blocks. These three are read together as the size of one problem,
          and a row layout buries each number at the end of its own line. */}
      <div className="flex flex-wrap gap-[var(--spacing-system-xl)] p-[var(--spacing-system-m)]">
        <OverageStat value={`${formatCount(device.overage)} Devices`} label="Device Overage" />
        {estimatedOverage != null && <OverageStat value={formatCurrency(estimatedOverage)} label="Overage Payment" />}
        {data.currentPeriodEnd && <OverageStat value={formatDate(data.currentPeriodEnd)} label="Next Billing" />}
      </div>
    </div>
  );
}
