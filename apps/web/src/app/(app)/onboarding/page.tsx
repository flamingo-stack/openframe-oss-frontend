'use client';

import { Suspense } from 'react';
import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { OnboardingContent } from './components/onboarding-content';
import { OnboardingSkeleton } from './components/onboarding-skeleton';

/** The Get Started tour. A SaaS tenant has no onboarding: there it forwards to Mingo's home. */
export default function OnboardingPage() {
  const mingoHome = isSaasTenantMode();
  useAppModeRedirect(mingoHome ? routes.mingo.home : null);

  if (mingoHome) return null;
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
