'use client';

import { Suspense } from 'react';
import { useShellRedirect, useShellVariant } from '@/app/hooks/use-shell-variant';
import { routes } from '@/lib/routes';
import { OnboardingContent } from './components/onboarding-content';
import { OnboardingSkeleton } from './components/onboarding-skeleton';

/**
 * The Get Started tour — every tenant has this route. The Mingo-first shell has no
 * onboarding, so there it forwards to Mingo's home; until the variant answers it
 * shows the tour's skeleton.
 */
export default function OnboardingPage() {
  const variant = useShellVariant();
  useShellRedirect(variant === 'mingo' ? routes.mingo.home : null);

  if (variant !== 'classic') return <OnboardingSkeleton />;
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
