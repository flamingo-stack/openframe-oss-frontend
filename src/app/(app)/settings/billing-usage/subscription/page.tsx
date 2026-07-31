'use client';

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { isBillingHidden } from '@/lib/billing-visibility';
import { BillingOwnerOnlyScreen } from '../components/billing-owner-only-screen';
import { SubscriptionSettingsSkeleton } from './components/subscription-settings-skeleton';
import { SubscriptionSettingsView } from './components/subscription-settings-view';

export default function SubscriptionSettingsPage() {
  // `isPaymentUiEnabled()` inlined as its two halves, because they resolve at
  // different times and only one of them can be waited on:
  //   - the build check is known immediately, so it 404s immediately;
  //   - the `billings` flag is not, and `notFound()` throws — firing it on an
  //     unanswered flag permanently 404s the page for a tenant that has billing.
  const gate = useFeatureFlagGate('billings');
  // Owner-only, like the Billing & Usage page this hangs off: an admin cannot reach
  // the plan picker, and the same "resolved answers only" rule applies to the 404.
  const owner = useOwnerGate();

  // Plan picker + Stripe Checkout entry point: gone entirely on builds where the
  // payment UI is hidden (see `billing-visibility.ts`), not just unlinked. That one
  // stays a 404 — on those builds the route does not exist at all, for anyone.
  if (isBillingHidden() || gate === 'off') {
    notFound();
  }
  if (gate === 'loading' || owner === 'loading') {
    return <SubscriptionSettingsSkeleton />;
  }
  // Not the owner: the same explanation the parent Billing page gives, rather than
  // a 404 — this is the deep link a shared "renew here" message would carry.
  if (owner === 'not-owner') {
    return <BillingOwnerOnlyScreen />;
  }

  return (
    <Suspense fallback={<SubscriptionSettingsSkeleton />}>
      <SubscriptionSettingsView />
    </Suspense>
  );
}
