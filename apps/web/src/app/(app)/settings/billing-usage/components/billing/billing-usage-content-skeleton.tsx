'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { isBillingReadOnly } from '@/lib/billing-visibility';
import { BillingReadOnlyNotice, TestModeBanner } from '../shared/billing-section';
import { BillingPageFrame, READ_ONLY_BILLING_ACTIONS } from './billing-page-frame';
import { DeviceUsageCard } from './device-usage-card';
import { FreeAiTokensCard } from './free-ai-tokens-card';
import { InvoicesHistory } from './invoices-history';
import { PaidAiTokensCard } from './paid-ai-tokens-card';
import { PlanSections } from './plan-sections';

/**
 * `BillingUsageContent` while ITS CODE downloads (it is a `next/dynamic` import, so the builds that may not show
 * payments never download it): the one wait the page cannot draw itself in. Everything here is the page's own: its
 * frame, and its parts in a loading scope, where each draws its own skeleton. Nothing is re-typed.
 *
 * Used ONLY on the `loading: () =>` line of the dynamic import in `billing-usage-view.tsx`.
 */
export function BillingUsageContentSkeleton() {
  const readOnly = isBillingReadOnly();
  return (
    <LoadingFallback label="Loading billing and usage">
      <BillingPageFrame actions={readOnly ? READ_ONLY_BILLING_ACTIONS : undefined}>
        {readOnly && <BillingReadOnlyNotice />}
        <TestModeBanner />
        <div className="grid gap-[var(--spacing-system-m)] content-md:grid-cols-3">
          <DeviceUsageCard subscription={null} />
          <FreeAiTokensCard subscription={null} />
          <PaidAiTokensCard subscription={null} autoTopUp={null} />
        </div>
        <PlanSections subscription={null} billingPlan={null} />
        <InvoicesHistory subscription={null} />
      </BillingPageFrame>
    </LoadingFallback>
  );
}
