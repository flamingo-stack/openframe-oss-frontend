'use client';

import { graphql, useFragment } from 'react-relay';
import type { updatedPlanSection_billingPlan$key } from '@/__generated__/updatedPlanSection_billingPlan.graphql';
import type { updatedPlanSection_subscription$key } from '@/__generated__/updatedPlanSection_subscription.graphql';
import { BillingPeriod } from '@/generated/schema-enums';
import { freeTokensForPlan } from '../shared/ai-free-tokens';
import { BillingRow, SectionBlock } from '../shared/billing-section';
import { catalogDeviceRate } from '../shared/catalog-device-rate';
import { planSchedule } from '../shared/plan-schedule';
import { MonthlyRate, MonthlyTokens, WarningDate } from '../shared/plan-values';

const updatedPlanSectionSubscriptionFragment = graphql`
  fragment updatedPlanSection_subscription on SubscriptionDetail {
    ...planSchedule_subscription
  }
`;

const updatedPlanSectionBillingPlanFragment = graphql`
  fragment updatedPlanSection_billingPlan on BillingPlanDetails {
    products {
      id
      ...catalogDeviceRate_product
    }
  }
`;

interface UpdatedPlanSectionProps {
  subscription: updatedPlanSection_subscription$key;
  billingPlan: updatedPlanSection_billingPlan$key | null;
}

/**
 * The plan the subscription moves to, described in the same vocabulary as the
 * current one — cycle, rate, grant — because the two sit side by side and
 * anything the left column states the right one has to be able to state too.
 *
 * Either a scheduled package, or the metered billing a lapsing commitment
 * falls back to. The pay-as-you-go case has no record to read: its cycle is
 * monthly by definition, its rate is the product's metered one, and it starts
 * the day the commitment ends.
 */
export function UpdatedPlanSection({ subscription, billingPlan }: UpdatedPlanSectionProps) {
  const schedule = planSchedule(useFragment(updatedPlanSectionSubscriptionFragment, subscription));
  const catalog = useFragment(updatedPlanSectionBillingPlanFragment, billingPlan);

  if (!schedule.hasPendingPlan) return null;

  const products = catalog?.products ?? [];
  const { pending } = schedule;
  // Metered billing has no period, so `null` asks the catalog for exactly that.
  const paygRate = schedule.paygPrice ?? catalogDeviceRate(products, null);
  const deviceRate = pending ? (pending.price ?? catalogDeviceRate(products, pending.billingPeriod)) : paygRate;
  const startsOn = pending ? pending.startsOn : schedule.currentPlanEndsOn;

  return (
    <SectionBlock title="Updated Plan">
      <BillingRow
        label="Billing Cycle"
        value={pending?.billingPeriod === BillingPeriod.YEARLY ? 'Annual' : 'Monthly'}
      />
      {deviceRate != null && <BillingRow label="Device Rate" value={<MonthlyRate amount={deviceRate} />} />}
      {/* Derived, not fetched — see `freeTokensForPlan`. A package keeps the larger grant. */}
      {schedule.carriesAi && (
        <BillingRow
          label="Free AI Tokens"
          value={<MonthlyTokens tokens={freeTokensForPlan(schedule.hasScheduledPackage)} />}
        />
      )}
      {startsOn && <BillingRow label="Plan Starts on" warning value={<WarningDate iso={startsOn} />} />}
    </SectionBlock>
  );
}
