'use client';

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { BillingOwnerOnlyScreen } from './components/billing-owner-only-screen';
import { BillingUsageSkeleton } from './components/billing-usage-skeleton';
import { BillingUsageView } from './components/billing-usage-view';

export default function BillingUsagePage() {
  // Only a definitive "off" 404s: `notFound()` throws, so firing it while the flag
  // is merely unanswered permanently 404s Billing for a tenant that has it. The
  // same skeleton the view suspends into covers the wait.
  const gate = useFeatureFlagGate('billings');
  // Billing is owner-only — the workspace's money, not every admin's. Same three-state
  // discipline: only a resolved "not an owner" 404s.
  const owner = useOwnerGate();

  // A missing feature 404s; a role refusal explains itself instead — the hub hides
  // the card, so whoever lands here followed a bookmark or a shared link.
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'loading' || owner === 'loading') {
    return <BillingUsageSkeleton />;
  }
  if (owner === 'not-owner') {
    return <BillingOwnerOnlyScreen />;
  }

  return (
    <Suspense fallback={<BillingUsageSkeleton />}>
      <BillingUsageView />
    </Suspense>
  );
}
