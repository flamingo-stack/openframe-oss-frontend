'use client';

import dynamic from 'next/dynamic';
import { isBillingHidden } from '@/lib/billing-visibility';
import { UsageView } from '../usage/usage-view';
import { BillingUsageContentSkeleton } from './billing-usage-content-skeleton';

// Lazy so a build that may not show payments (the mobile builds) never
// pulls the billing page in:
// its query carries prices, next payment and invoices, and its module carries
// the cancel/resume/checkout flows. Static, they would ride along with the
// usage-only page that replaces it. While its code downloads it is the one
// wait the page cannot draw itself in, so its own skeleton stands for it.
const BillingUsageContent = dynamic(
  () => import('./billing-usage-content').then(m => ({ default: m.BillingUsageContent })),
  { ssr: false, loading: () => <BillingUsageContentSkeleton /> },
);

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
