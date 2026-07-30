'use client';

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { runtimeEnv } from '@/lib/runtime-config';
import { OnboardingContent } from './components/onboarding-content';
import { OnboardingSkeleton } from './components/onboarding-skeleton';

export default function OnboardingPage() {
  // Gated behind the `new-onboarding` flag — when off, the legacy dashboard
  // onboarding section is shown instead and this route does not exist.
  //
  // Only a definitive "off" 404s: `notFound()` throws, so firing it while the flag
  // is merely unanswered permanently 404s a route the tenant does have. The same
  // skeleton the content suspends into covers the wait.
  const gate = useFeatureFlagGate('new-onboarding', runtimeEnv.newOnboardingFlag());

  if (gate === 'off') {
    notFound();
  }
  if (gate === 'loading') {
    return <OnboardingSkeleton />;
  }

  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
