'use client';

import { notFound } from 'next/navigation';
import { useBillingAccessGate } from '@/app/hooks/use-billing-access-gate';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { BillingRestrictedScreen } from './components/billing/billing-restricted-screen';
import { BillingUsageView } from './components/billing/billing-usage-view';

export default function BillingUsagePage() {
  // Only a definitive "off" 404s: `notFound()` throws, so firing it while the flag
  // is merely unanswered permanently 404s Billing for a tenant that has it. The
  // page draws itself in its loading scope while it waits.
  const gate = useFeatureFlagGate('billings');
  // Billing is for the people who run the workspace — owners and admins. Same
  // three-state discipline: only a resolved "denied" closes the page.
  const access = useBillingAccessGate();

  // A missing feature 404s; a role refusal explains itself instead — the hub hides
  // the card, so whoever lands here followed a bookmark or a shared link.
  if (gate === 'off') {
    notFound();
  }
  if (gate !== 'loading' && access === 'denied') {
    return <BillingRestrictedScreen />;
  }

  return <BillingUsageView loading={gate === 'loading' || access === 'loading'} />;
}
