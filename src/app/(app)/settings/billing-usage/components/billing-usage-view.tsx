'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { isBillingHidden } from '@/lib/billing-visibility';
import { BillingUsageSkeleton } from './billing-usage-skeleton';
import { UsageView } from './usage-view';

// Lazy so a build that may not show payments never pulls the billing page in:
// its query carries prices, next payment and invoices, and its module carries
// the cancel/resume/checkout flows. Static, they would ride along with the
// usage-only page that replaces it.
const BillingUsageContent = dynamic(
  () => import('./billing-usage-content').then(m => ({ default: m.BillingUsageContent })),
  { ssr: false, loading: () => <BillingUsageSkeleton /> },
);

/**
 * Entry point for `/settings/billing-usage`, picking the page the build is
 * allowed to show (see `billing-visibility.ts`):
 *   - payments hidden → `UsageView`, consumption counters over its own
 *     price-free query;
 *   - otherwise → the full billing page.
 *
 * The choice happens before either component mounts, so the mobile path never
 * runs the billing query or its cancellation hooks.
 */
export function BillingUsageView() {
  return (
    <Suspense fallback={<BillingUsageSkeleton />}>
      {isBillingHidden() ? <UsageView /> : <BillingUsageContent />}
    </Suspense>
  );
}
