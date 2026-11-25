'use client';

import { usePageFallback } from '@/app/components/page-fallback-context';
import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { OnboardingContent } from './components/onboarding-content';

/**
 * The Get Started tour. A SaaS tenant has no onboarding: there it forwards to Mingo's home, with the query and the
 * fragment, and the shell draws it as Mingo's home and a landing route (`isSaasOnboardingRoute`), so until `/mingo`
 * renders it shows the page slot's stand-in, Start Work's skeleton, not an empty page (CU-17tkuw69uzp). The content
 * draws its own loading state.
 */
export default function OnboardingPage() {
  const mingoHome = isSaasTenantMode();
  const fallback = usePageFallback();
  useAppModeRedirect(mingoHome ? routes.mingo.home : null, { carryLocation: true });

  if (mingoHome) return fallback;
  return <OnboardingContent />;
}
