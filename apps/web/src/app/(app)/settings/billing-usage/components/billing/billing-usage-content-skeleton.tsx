'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { noop } from '@/app/components/shared/no-next-page';
import { isBillingReadOnly } from '@/lib/billing-visibility';
import { BillingPageFrame, READ_ONLY_BILLING_ACTIONS } from './billing-page-frame';
import { BillingSections } from './billing-sections';

/**
 * `BillingUsageContent` while ITS CODE downloads (it is a `next/dynamic` import, so the builds that may not show
 * payments never download it): the one wait the page cannot draw itself in. Everything here is the page's own: its
 * frame (the header's actions as placeholders, except the read-only build's one action, which is stated) and its
 * sections in a loading scope, where each draws its own loading state. Nothing is re-typed.
 *
 * Used ONLY on the `loading: () =>` line of the dynamic import in `billing-usage-view.tsx`.
 */
export function BillingUsageContentSkeleton() {
  const readOnly = isBillingReadOnly();
  return (
    <LoadingFallback label="Loading billing and usage">
      <BillingPageFrame actions={readOnly ? READ_ONLY_BILLING_ACTIONS : undefined} loadingActions={!readOnly}>
        <BillingSections readOnly={readOnly} subscription={null} billingPlan={null} showAiCards onClockChanged={noop} />
      </BillingPageFrame>
    </LoadingFallback>
  );
}
