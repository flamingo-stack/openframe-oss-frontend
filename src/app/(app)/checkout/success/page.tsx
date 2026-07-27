'use client';

import { CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { CheckoutResultCard } from '../components/checkout-result-card';

export default function CheckoutSuccessPage() {
  // Stripe Checkout can't be started from a build with the payment UI hidden, so
  // its result page must not exist there either (see `billing-visibility.ts`).
  if (isBillingHidden()) {
    notFound();
  }

  return (
    <CheckoutResultCard
      icon={CheckCircle2}
      iconWrapperClassName="bg-ods-success-secondary text-ods-success"
      title="Payment Successful"
      description="Thanks for subscribing. Your plan is activating now — it may take a moment to show up across the app."
      primaryCta={{ label: 'Continue to Dashboard', href: routes.dashboard }}
      secondaryCta={{ label: 'View Subscription', href: routes.settings.billingSubscription }}
    />
  );
}
