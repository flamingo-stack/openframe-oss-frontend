'use client';

import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { OnboardingContent } from './components/onboarding-content';

/**
 * The Get Started tour. A SaaS tenant has no onboarding: there it forwards to Mingo's home. The content draws its own
 * loading state.
 */
export default function OnboardingPage() {
  const mingoHome = isSaasTenantMode();
  useAppModeRedirect(mingoHome ? routes.mingo.home : null);

  if (mingoHome) return null;
  return <OnboardingContent />;
}
