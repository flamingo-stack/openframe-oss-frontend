'use client';

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isPaymentUiEnabled } from '@/lib/billing-visibility';
import { SubscriptionSettingsSkeleton } from './components/subscription-settings-skeleton';
import { SubscriptionSettingsView } from './components/subscription-settings-view';

export default function SubscriptionSettingsPage() {
  // Plan picker + Stripe Checkout entry point: gone entirely on builds where the
  // payment UI is hidden (see `billing-visibility.ts`), not just unlinked.
  if (!isPaymentUiEnabled()) {
    notFound();
  }

  return (
    <Suspense fallback={<SubscriptionSettingsSkeleton />}>
      <SubscriptionSettingsView />
    </Suspense>
  );
}
