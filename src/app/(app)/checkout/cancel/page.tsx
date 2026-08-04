'use client';

import { XCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { isPaymentUiEnabled } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { CheckoutResultCard } from '../components/checkout-result-card';

export default function CheckoutCancelPage() {
  // Stripe Checkout can't be started unless the payment UI is available, so its
  // result page must not exist otherwise either — that means the `billings` flag
  // AND a build allowed to show payments (see `billing-visibility.ts`).
  if (!isPaymentUiEnabled()) {
    notFound();
  }

  return (
    <CheckoutResultCard
      icon={XCircle}
      iconWrapperClassName="bg-ods-error-secondary text-ods-error"
      title="Payment Cancelled"
      description="No charges were made. You can pick a plan whenever you're ready."
      primaryCta={{ label: 'Back to Billing', href: routes.settings.billingUsage }}
      secondaryCta={{ label: 'Go to Dashboard', href: routes.dashboard }}
    />
  );
}
