'use client';

import { XCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { CheckoutResultCard } from '../components/checkout-result-card';

export default function CheckoutCancelPage() {
  // Same gate, and the same reasoning, as `../success/page.tsx` — see the note
  // there for why the `billings` flag may only 404 this page once it has actually
  // answered.
  const gate = useFeatureFlagGate('billings');
  if (isBillingHidden() || gate === 'off') {
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
      pending={gate === 'loading'}
    />
  );
}
