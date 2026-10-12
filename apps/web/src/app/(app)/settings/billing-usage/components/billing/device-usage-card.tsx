'use client';

import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { deviceUsageCard_subscription$key } from '@/__generated__/deviceUsageCard_subscription.graphql';
import { BillingPeriod } from '@/generated/schema-enums';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { deviceAllocation } from '../shared/device-allocation';
import { planSchedule } from '../shared/plan-schedule';
import { StatEmphasis, StatSuffix, UsageStatCard } from '../shared/usage-stat-card';

/**
 * The count against its allocation (`deviceAllocation`, shared with the overage
 * block under the card) and the package that sets the caption (`planSchedule`,
 * shared with the plan sections) — two readers, so the card cannot disagree
 * with either neighbour. Only the trial's end date is its own.
 */
const deviceUsageCardFragment = graphql`
  fragment deviceUsageCard_subscription on SubscriptionDetail {
    trialExpirationDate
    ...deviceAllocation_subscription
    ...planSchedule_subscription
  }
`;

/**
 * The line under the device count: what the count is measured against, or how it
 * is billed.
 *
 * A trial is neither — its count has no allocation to sit against (which is why
 * the figure above is bare), so the line answers the question a trial actually
 * raises: when it runs out. Without a `trialExpirationDate` from the server
 * there is nothing to date it with, and nothing here invents one; the line falls
 * back to stating the trial, not to another date.
 */
function caption(isTrial: boolean, trialEndsOn: string | null, prepaid: boolean, isAnnual: boolean): ReactNode {
  if (isTrial) {
    if (!trialEndsOn) return 'Included in trial';
    return (
      <>
        Trial Period ends <StatEmphasis>{formatDate(trialEndsOn)}</StatEmphasis>
      </>
    );
  }
  if (prepaid) return isAnnual ? 'Annual Prepaid' : 'Monthly Prepaid';
  return 'Pay as you go';
}

/** Devices under management, against the package that covers them. */
export function DeviceUsageCard({ subscription }: { subscription: deviceUsageCard_subscription$key }) {
  const data = useFragment(deviceUsageCardFragment, subscription);
  const device = deviceAllocation(data);
  const schedule = planSchedule(data);

  const isAnnual = schedule.active?.billingPeriod === BillingPeriod.YEARLY;
  // A committed package is the only thing that gives the counter a denominator,
  // so the same condition decides the caption — the card cannot end up reading
  // "247/300" over "Pay as you go", or a bare count over "Prepaid".
  const prepaid = !schedule.isTrial && device.allocation > 0;

  return (
    <UsageStatCard
      title="Device Usage"
      tone={device.overLimit ? 'warning' : 'default'}
      value={
        prepaid ? (
          <>
            {formatCount(device.used)}
            <StatSuffix>/{formatCount(device.allocation)}</StatSuffix>
          </>
        ) : (
          formatCount(device.used)
        )
      }
      caption={caption(schedule.isTrial, (data.trialExpirationDate ?? null) as string | null, prepaid, isAnnual)}
    />
  );
}
