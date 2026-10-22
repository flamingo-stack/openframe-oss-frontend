'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { billingSections_billingPlan$key } from '@/__generated__/billingSections_billingPlan.graphql';
import type { billingSections_subscription$key } from '@/__generated__/billingSections_subscription.graphql';
import { BillingReadOnlyNotice, TestModeBanner } from '../shared/billing-section';
import { TestClockPanel } from '../test-clock/test-clock-panel';
import { DeviceUsageCard } from './device-usage-card';
import { FreeAiTokensCard } from './free-ai-tokens-card';
import { InvoicesHistory } from './invoices-history';
import { PaidAiTokensCard } from './paid-ai-tokens-card';
import { PlanSections } from './plan-sections';

const billingSectionsSubscriptionFragment = graphql`
  fragment billingSections_subscription on SubscriptionDetail {
    ...deviceUsageCard_subscription
    ...freeAiTokensCard_subscription
    ...paidAiTokensCard_subscription
    ...planSections_subscription
    ...invoicesHistory_subscription
  }
`;

const billingSectionsBillingPlanFragment = graphql`
  fragment billingSections_billingPlan on BillingPlanDetails {
    ...planSections_billingPlan
  }
`;

interface BillingSectionsProps {
  /** The desktop build: the notice that billing is changed in the browser. */
  readOnly: boolean;
  /** `null` while the page loads (each part then draws its own loading state in the scope). */
  subscription: billingSections_subscription$key | null;
  billingPlan: billingSections_billingPlan$key | null;
  /** The two AI counters beside the devices one. */
  showAiCards: boolean;
  onClockChanged: () => void;
  /** The paid-tokens card with its auto top-up mark; without it, the card without the mark. */
  paidAiCard?: ReactNode;
  /** What sits after the invoices (the AI balance alert, the auto top-up notice, the device overage), each optional. */
  notices?: ReactNode;
}

/**
 * The billing page's body, in order: the counters, the plan, the invoices and the notices. One module for the page
 * (`BillingUsageScreen`) and the wait for its code (`billing-usage-view.tsx`'s dynamic fallback), which renders it with no data in a
 * loading scope, so the two can never draw different pages.
 */
export function BillingSections({
  readOnly,
  subscription: subscriptionRef,
  billingPlan: billingPlanRef,
  showAiCards,
  onClockChanged,
  paidAiCard,
  notices,
}: BillingSectionsProps) {
  const subscription = useFragment(billingSectionsSubscriptionFragment, subscriptionRef) ?? null;
  const billingPlan = useFragment(billingSectionsBillingPlanFragment, billingPlanRef) ?? null;
  return (
    <>
      {readOnly && <BillingReadOnlyNotice />}

      {/* Dev-only; renders nothing (and issues no requests) unless the test-clock flag is on. In the page's loading
          scope it draws itself without its query. */}
      <TestClockPanel onClockChanged={onClockChanged} />

      {/* Two AI counters, because AI runs on two figures: what the period gives
          away, and the balance it draws from once that is spent. */}
      {/* One column below md; three (devices and the AI pair) or one (devices alone) from md. */}
      <div
        className={cn(
          'grid gap-[var(--spacing-system-m)]',
          showAiCards ? 'content-md:grid-cols-3' : 'content-md:grid-cols-1',
        )}
      >
        <DeviceUsageCard subscription={subscription} />
        {showAiCards && (
          <>
            <FreeAiTokensCard subscription={subscription} />
            {paidAiCard ?? <PaidAiTokensCard subscription={subscription} autoTopUp={null} />}
          </>
        )}
      </div>

      <PlanSections subscription={subscription} billingPlan={billingPlan} />

      <InvoicesHistory subscription={subscription} />

      {/* Below the first screen: each notice (and the test-mode banner) is a part only some accounts have
          (`data-loading-optional`), so one appearing never moves the counters, the plan or the invoices. */}
      {notices}

      <TestModeBanner />
    </>
  );
}
