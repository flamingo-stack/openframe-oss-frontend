'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import dynamic from 'next/dynamic';
import { noop } from '@/app/components/shared/no-next-page';
import { isBillingHidden, isBillingReadOnly } from '@/lib/billing-visibility';
import { UsageView } from '../usage/usage-view';
import { BillingPageFrame, READ_ONLY_BILLING_ACTIONS } from './billing-page-frame';
import { BillingSections } from './billing-sections';

// Lazy so a build that may not show payments (the mobile builds) never
// pulls the billing page in:
// its query carries prices, next payment and invoices, and its module carries
// the cancel/resume/checkout flows. Static, they would ride along with the
// usage-only page that replaces it. While its code downloads (the one wait
// the page cannot draw itself in) the fallback is what `BillingUsageScreen`
// draws with no data: the page's own frame (its header actions as
// placeholders, except the read-only build's one stated action) and its
// sections, in a loading scope where each part draws its own loading form.
const BillingUsageContent = dynamic(
  () => import('./billing-usage-content').then(m => ({ default: m.BillingUsageContent })),
  { ssr: false, loading: () => <BillingUsageCodePending /> },
);

/** `BillingUsageScreen` with no data, from the static modules it is built of (the frame and the sections). */
function BillingUsageCodePending() {
  const readOnly = isBillingReadOnly();
  return (
    <LoadingFallback label="Loading billing and usage">
      <BillingPageFrame actions={readOnly ? READ_ONLY_BILLING_ACTIONS : undefined} loadingActions={!readOnly}>
        <BillingSections readOnly={readOnly} subscription={null} billingPlan={null} showAiCards onClockChanged={noop} />
      </BillingPageFrame>
    </LoadingFallback>
  );
}

/**
 * Entry point for `/settings/billing-usage`, picking the page the build is
 * allowed to show (see `billing-visibility.ts`):
 *   - payments hidden (mobile) → `UsageView`, consumption counters over its
 *     own price-free query;
 *   - otherwise → the billing page, which renders itself read-only on the
 *     desktop build.
 *
 * The choice happens before either component mounts, so the mobile builds never
 * run the billing query or its cancellation hooks. `loading` (the page's gates
 * have not answered) draws the chosen page in its loading scope, without its query.
 */
export function BillingUsageView({ loading = false }: { loading?: boolean }) {
  return isBillingHidden() ? <UsageView loading={loading} /> : <BillingUsageContent loading={loading} />;
}
