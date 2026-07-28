'use client';

import { Suspense } from 'react';
import { SubscriptionSettingsSkeleton } from '@/app/(app)/settings/billing-usage/subscription/components/subscription-settings-skeleton';
import { SubscriptionSettingsView } from '@/app/(app)/settings/billing-usage/subscription/components/subscription-settings-view';

/**
 * Plan-picker lock screen for the web and desktop builds: the normal
 * subscription settings page, which reacts to lock state via context to swap its
 * header for the "trial has ended" banner and change the submit CTA.
 *
 * Its own module, loaded lazily by `subscription-lock-content.tsx`, so the plan
 * cards, prices and Stripe Checkout entry point are not in the import graph of
 * every page that renders `AppLayout` — which is what pulled them into the
 * mobile bundles' shared chunk. Default export: `next/dynamic` entry point.
 */
export default function SubscriptionPlanLockContent() {
  return (
    <Suspense fallback={<SubscriptionSettingsSkeleton />}>
      <SubscriptionSettingsView />
    </Suspense>
  );
}
