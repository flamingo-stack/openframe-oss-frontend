'use client';

import { Suspense } from 'react';
import { OnboardingContent } from './components/onboarding-content';
import { OnboardingSkeleton } from './components/onboarding-skeleton';

/** The Get Started tour. Unconditional — every tenant has this route. */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
