'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  deviceUsageCard_subscription$data,
  deviceUsageCard_subscription$key,
} from '@/__generated__/deviceUsageCard_subscription.graphql';
import { BillingPeriod } from '@/generated/schema-enums';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { DEVICE_BILLING_TERMS_URL } from '@/lib/legal-urls';
import { deviceAllocation } from '../shared/device-allocation';
import { planSchedule } from '../shared/plan-schedule';
import { StatEmphasis, StatLink, StatSuffix, UsageStatCard } from '../shared/usage-stat-card';

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

/** Both forms of the caption run to two lines: a trial's two facts, a plan's billing and how it works. */
const CAPTION_LINES = 2;

/**
 * The line under the device count: what the count is measured against, or how it
 * is billed.
 *
 * A trial is neither — its count has no allocation to sit against (which is why
 * the figure above is bare) and nothing is billed for it, so the lines answer the
 * questions a trial actually raises: what the devices cost, and when that runs
 * out. Without a `trialExpirationDate` from the server there is nothing to date
 * it with, and nothing here invents one; the date line is left out, not swapped
 * for another date.
 */
function caption(isTrial: boolean, trialEndsOn: string | null, prepaid: boolean, isAnnual: boolean): ReactNode {
  if (isTrial) {
    return (
      <>
        <span className="block truncate">Free Device Usage period.</span>
        {trialEndsOn && (
          <span className="block truncate">
            Trial Period ends <StatEmphasis>{formatDate(trialEndsOn)}</StatEmphasis>
          </span>
        )}
      </>
    );
  }
  return (
    <>
      <span className="block truncate">
        {prepaid ? (isAnnual ? 'Annual Prepaid' : 'Monthly Prepaid') : 'Pay as you go'}
      </span>
      <span className="block truncate">
        <StatLink href={DEVICE_BILLING_TERMS_URL}>How device billing works</StatLink>
      </span>
    </>
  );
}

/** Devices under management, against the package that covers them. */
export function DeviceUsageCard({ subscription }: { subscription: deviceUsageCard_subscription$key | null }) {
  const data = useFragment(deviceUsageCardFragment, subscription);
  // One card, both forms: `null` only while the page loads (it renders itself in a loading scope with no
  // subscription yet), when the figure and the caption are bars.
  const shown = useLoadingScope() || data == null ? null : deviceUsage(data);

  return (
    <UsageStatCard
      title="Device Usage"
      loading={shown == null}
      tone={shown?.tone}
      value={shown?.value}
      caption={shown?.caption}
      captionLines={CAPTION_LINES}
    />
  );
}

/** What the loaded card states: its tone, the count (against its allocation when prepaid) and the caption. */
function deviceUsage(data: deviceUsageCard_subscription$data) {
  const device = deviceAllocation(data);
  const schedule = planSchedule(data);

  const isAnnual = schedule.active?.billingPeriod === BillingPeriod.YEARLY;
  // A committed package is the only thing that gives the counter a denominator,
  // so the same condition decides the caption — the card cannot end up reading
  // "247/300" over "Pay as you go", or a bare count over "Prepaid".
  // Metered billing has no allowance whatever a period's figures say.
  const prepaid = !schedule.isTrial && !device.isPayg && device.allocation > 0;

  return {
    tone: device.overLimit ? ('warning' as const) : ('default' as const),
    // Against the allowance, the count is the devices counted against it: the
    // ones frozen as overage at an upgrade are billed already and sit in the
    // overage block, not over this period's limit a second time.
    value: prepaid ? (
      <>
        {formatCount(device.usedAgainstLimit)}
        <StatSuffix>/{formatCount(device.allocation)}</StatSuffix>
      </>
    ) : (
      formatCount(device.used)
    ),
    caption: caption(schedule.isTrial, (data.trialExpirationDate ?? null) as string | null, prepaid, isAnnual),
  };
}
