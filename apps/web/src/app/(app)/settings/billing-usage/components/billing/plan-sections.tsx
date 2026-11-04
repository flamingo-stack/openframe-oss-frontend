'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { planSections_billingPlan$key } from '@/__generated__/planSections_billingPlan.graphql';
import type { planSections_subscription$key } from '@/__generated__/planSections_subscription.graphql';
import { planSchedule } from '../shared/plan-schedule';
import { CurrentPlanSection } from './current-plan-section';
import { UpdatedPlanSection } from './updated-plan-section';

const planSectionsSubscriptionFragment = graphql`
  fragment planSections_subscription on SubscriptionDetail {
    ...planSchedule_subscription
    ...currentPlanSection_subscription
    ...updatedPlanSection_subscription
  }
`;

const planSectionsBillingPlanFragment = graphql`
  fragment planSections_billingPlan on BillingPlanDetails {
    ...currentPlanSection_billingPlan
    ...updatedPlanSection_billingPlan
  }
`;

interface PlanSectionsProps {
  /** `null` only while the page loads. */
  subscription: planSections_subscription$key | null;
  billingPlan: planSections_billingPlan$key | null;
}

/**
 * Current Plan, and beside it the plan that takes over when one is scheduled.
 *
 * Side by side once there is a second block to read against the plan; on its
 * own, Current Plan takes the full width. A trial has no plan to state: nothing
 * is billed until it is activated, its one date is on the device card, and the
 * header offers activation.
 */
export function PlanSections({ subscription, billingPlan }: PlanSectionsProps) {
  const data = useFragment(planSectionsSubscriptionFragment, subscription);
  const catalog = useFragment(planSectionsBillingPlanFragment, billingPlan);

  // Loading: Current Plan, which draws its own loading state. Whether a pending plan sits beside it is what the
  // subscription has not said yet (it rarely does).
  if (useLoadingScope() || data == null) {
    return (
      <div className="grid grid-cols-1 items-start gap-[var(--spacing-system-l)]">
        <CurrentPlanSection subscription={null} billingPlan={null} />
      </div>
    );
  }

  const schedule = planSchedule(data);

  if (schedule.isTrial) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-1 items-start gap-[var(--spacing-system-l)]',
        schedule.hasPendingPlan && 'content-md:grid-cols-2',
      )}
    >
      <CurrentPlanSection subscription={data} billingPlan={catalog ?? null} />
      {schedule.hasPendingPlan && <UpdatedPlanSection subscription={data} billingPlan={catalog ?? null} />}
    </div>
  );
}
