'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { currentPlanSection_billingPlan$key } from '@/__generated__/currentPlanSection_billingPlan.graphql';
import type { currentPlanSection_subscription$key } from '@/__generated__/currentPlanSection_subscription.graphql';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { BillingPeriod } from '@/generated/schema-enums';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { BillingRow, SectionBlock } from '../shared/billing-section';
import { catalogDeviceRate } from '../shared/catalog-device-rate';
import { planSchedule } from '../shared/plan-schedule';
import { MonthlyRate, MonthlyTokens } from '../shared/plan-values';

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
  /** `null` only while the page loads. */
  subscription: currentPlanSection_subscription$key | null;
  billingPlan: currentPlanSection_billingPlan$key | null;
}

export function CurrentPlanSection({ subscription, billingPlan }: CurrentPlanSectionProps) {
  const data = useFragment(currentPlanSectionSubscriptionFragment, subscription);
  const catalog = useFragment(currentPlanSectionBillingPlanFragment, billingPlan);
  // ONE row rule for both forms: while the subscription is on its way the same rows are drawn, labels real and each
  // value its row's own loading state. Every row is drawn whenever most plans have it; a value a plan lacks is the
  // empty mark ("Plan ends on" for a plan that does not end).
  const loading = useLoadingScope() || data == null;
  const schedule = data ? planSchedule(data) : null;
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
  const deviceRate = !schedule
    ? null
    : schedule.deviceIsPayg || schedule.isTrial
      ? (schedule.paygPrice ?? catalogDeviceRate(products, null))
      : (schedule.active?.price ?? catalogDeviceRate(products, schedule.active?.billingPeriod ?? null));
  // A committed yearly package is the only thing that makes the cycle annual;
  // pay-as-you-go and every monthly package bill each month. A trial states itself.
  const isAnnual = schedule?.active?.billingPeriod === BillingPeriod.YEARLY;
  const cycle = schedule?.isTrial ? 'Free trial' : isAnnual ? 'Annual' : 'Monthly';
  // Always stated: nothing to bill reads "$0.00", so the row is there in every form.
  const nextPayment = data?.nextPayment ?? 0;
  // GraphQL `Long` arrives as a string or a number depending on its size.
  const freeTokens = Number(data?.usage?.aiTokensFree ?? 0);
  const planEndsOn = data?.cancellationEffectiveAt ?? schedule?.currentPlanEndsOn ?? null;

  return (
    <SectionBlock title="Current Plan">
      <BillingRow loading={loading} label="Billing Cycle" value={loading ? undefined : cycle} />
      {/* Every plan has a device rate (its own, or the catalog's for its period). */}
      <BillingRow
        loading={loading}
        label="Device Rate"
        value={deviceRate == null ? undefined : <MonthlyRate amount={deviceRate} />}
      />
      {/* The typical plan carries the AI product: drawn while loading. */}
      {(loading || schedule?.carriesAi) && (
        <BillingRow
          loading={loading}
          label="Free AI Tokens"
          value={loading ? undefined : <MonthlyTokens tokens={freeTokens} />}
        />
      )}
      <BillingRow loading={loading} label="Next Payment" value={loading ? undefined : formatCurrency(nextPayment)} />
      {/* Independent rows, not one slot fought over by several dates: each is
          present exactly when its own field is. A plan that is ending still has
          a billing date, and Figma shows both — they land on the same day
          because the subscription runs to the end of the paid period and stops
          there, which is two facts, not one repeated. A running subscription has
          a period end, so that row is drawn while loading. */}
      {(loading || data?.currentPeriodEnd) && (
        <BillingRow
          loading={loading}
          label="Next Billing Date"
          value={data?.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : undefined}
        />
      )}
      {/* One row, always: a bar while loading, the date the plan stops (the termination first, else the package's
          own end), the empty mark for a plan that does not end. */}
      <BillingRow
        loading={loading}
        label="Plan ends on"
        warning={planEndsOn != null}
        value={planEndsOn ? formatDate(planEndsOn) : <EmptyValue />}
      />
    </SectionBlock>
  );
}
