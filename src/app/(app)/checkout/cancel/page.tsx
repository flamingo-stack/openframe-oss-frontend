'use client';

import { XCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { CheckoutResultCard } from '../components/checkout-result-card';

export default function CheckoutCancelPage() {
  // Stripe Checkout can't be started from a build with the payment UI hidden, so
  // its result page must not exist there either (see `billing-visibility.ts`).
  if (isBillingHidden()) {
    notFound();
  }

  return (
    <CheckoutResultCard
      icon={XCircle}
      iconWrapperClassName="bg-ods-error-secondary text-ods-error"
      title="Payment Cancelled"
      description="No charges were made. You can pick a plan whenever you're ready."
      primaryCta={{ label: 'Back to Plans', href: routes.settings.billingSubscription }}
      secondaryCta={{ label: 'Go to Dashboard', href: routes.dashboard }}
    />
  );
}
