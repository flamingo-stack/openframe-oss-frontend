'use client';

import { graphql, useFragment } from 'react-relay';
import type { currentPlanSection_billingPlan$key } from '@/__generated__/currentPlanSection_billingPlan.graphql';
import type { currentPlanSection_subscription$key } from '@/__generated__/currentPlanSection_subscription.graphql';
import { BillingPeriod } from '@/generated/schema-enums';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { BillingRow, SectionBlock } from '../shared/billing-section';
import { catalogDeviceRate } from '../shared/catalog-device-rate';
import { planSchedule } from '../shared/plan-schedule';
import { MonthlyRate, MonthlyTokens, WarningDate } from '../shared/plan-values';

const currentPlanSectionSubscriptionFragment = graphql`
  fragment currentPlanSection_subscription on SubscriptionDetail {
    # Projected next-invoice total, computed server-side (PAYG overage accrued
    # so far + package charges due next cycle). The SSOT for the "Next Payment"
    # row — the UI does not re-derive it from product prices.
    nextPayment
    # Three dates, three fields, no substituting one for another:
    #  - currentPeriodEnd: end of the paid period; for ACTIVE, the renewal date.
    #  - cancellationEffectiveAt: when the subscription is terminated; non-null
    #    only for PENDING_CANCELLATION / CANCELED.
    #  - the package's own endDate (read through planSchedule): when THAT
    #    package stops, not when the subscription bills.
    currentPeriodEnd
    cancellationEffectiveAt
    # The grant the tenant is actually on this period, served by the backend —
    # unlike the Updated Plan's, which has to be derived.
    usage {
      aiTokensFree
    }
    ...planSchedule_subscription
  }
`;

const currentPlanSectionBillingPlanFragment = graphql`
  fragment currentPlanSection_billingPlan on BillingPlanDetails {
    products {
      id
      ...catalogDeviceRate_product
    }
  }
`;

interface CurrentPlanSectionProps {
  subscription: currentPlanSection_subscription$key;
  billingPlan: currentPlanSection_billingPlan$key | null;
}

export function CurrentPlanSection({ subscription, billingPlan }: CurrentPlanSectionProps) {
  const data = useFragment(currentPlanSectionSubscriptionFragment, subscription);
  const catalog = useFragment(currentPlanSectionBillingPlanFragment, billingPlan);
  const schedule = planSchedule(data);
  const products = catalog?.products ?? [];

  /**
   * What one device costs per month — the metered rate, or the rate the active
   * package fixed. Every figure in play is per device per month (the same scale
   * as `priceTiers.unitPrice`), so an annual commitment states a monthly rate
   * here and bills twelve of them at once.
   *
   * The subscription's own price first — a negotiated rate is what this tenant
   * is actually billed — then the catalog's rate FOR THE PERIOD the plan is on.
   * Never borrowed across periods: an annual plan is not billed at the metered
   * rate, and printing that here would name a price the user is not paying —
   * which is exactly what a plain "first price band" read did, quoting the
   * undiscounted $1.00 to a subscription paying $0.80.
   */
  const deviceRate = schedule.deviceIsPayg
    ? (schedule.paygPrice ?? catalogDeviceRate(products, null))
    : (schedule.active?.price ?? catalogDeviceRate(products, schedule.active?.billingPeriod ?? null));
  // A committed yearly package is the only thing that makes the cycle annual;
  // pay-as-you-go and every monthly package bill each month.
  const isAnnual = schedule.active?.billingPeriod === BillingPeriod.YEARLY;
  // Omitted when there is nothing to bill (null / 0) instead of a "Free" placeholder.
  const nextPayment = data.nextPayment ?? 0;
  // GraphQL `Long` arrives as a string or a number depending on its size.
  const freeTokens = Number(data.usage?.aiTokensFree ?? 0);

  return (
    <SectionBlock title="Current Plan">
      <BillingRow label="Billing Cycle" value={isAnnual ? 'Annual' : 'Monthly'} />
      {deviceRate != null && <BillingRow label="Device Rate" value={<MonthlyRate amount={deviceRate} />} />}
      {schedule.carriesAi && <BillingRow label="Free AI Tokens" value={<MonthlyTokens tokens={freeTokens} />} />}
      {nextPayment > 0 && <BillingRow label="Next Payment" value={formatCurrency(nextPayment)} />}
      {/* Independent rows, not one slot fought over by several dates: each is
          present exactly when its own field is. A plan that is ending still has
          a billing date, and Figma shows both — they land on the same day
          because the subscription runs to the end of the paid period and stops
          there, which is two facts, not one repeated. */}
      {data.currentPeriodEnd && <BillingRow label="Next Billing Date" value={formatDate(data.currentPeriodEnd)} />}
      {data.cancellationEffectiveAt && (
        <BillingRow label="Plan ends on" warning value={<WarningDate iso={data.cancellationEffectiveAt} />} />
      )}
      {schedule.currentPlanEndsOn && (
        <BillingRow label="Plan ends on" warning value={<WarningDate iso={schedule.currentPlanEndsOn} />} />
      )}
    </SectionBlock>
  );
}
