'use client';

import { CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { CheckoutResultCard } from '../components/checkout-result-card';

export default function CheckoutSuccessPage() {
  // Stripe Checkout can't be started unless the payment UI is available, so its
  // result page must not exist otherwise either — that means the `billings` flag
  // AND a build allowed to show payments (see `billing-visibility.ts`).
  //
  // The two halves are asked separately because only one of them is knowable
  // now. `isBillingHidden()` reads the shell, which is decided before the first
  // paint. The flag is server-loaded and uncached, so it is UNANSWERED on a cold
  // load — and this page only ever arrives on a cold load, since Stripe returns
  // the user by a full navigation. Gating on the snapshot `isPaymentUiEnabled()`
  // therefore read "not yet" as "not allowed" and called `notFound()` on the
  // first render, every time: `notFound()` throws, nothing here subscribes to
  // the flags store, so the 404 was permanent and every paying customer met it.
  // Only a resolved `off` may 404 — the same rule as `billing-usage/page.tsx`.
  const gate = useFeatureFlagGate('billings');
  if (isBillingHidden() || gate === 'off') {
    notFound();
  }

  return (
    <CheckoutResultCard
      icon={CheckCircle2}
      iconWrapperClassName="bg-ods-success-secondary text-ods-success"
      title="Payment Successful"
      description="Thanks for subscribing. Your plan is activating now — it may take a moment to show up across the app."
      primaryCta={{ label: 'Continue to Dashboard', href: routes.dashboard }}
      secondaryCta={{ label: 'View Subscription', href: routes.settings.billingUsage }}
      pending={gate === 'loading'}
    />
  );
}
