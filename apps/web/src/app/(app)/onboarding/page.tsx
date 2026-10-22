'use client';

import { OnboardingContent } from './components/onboarding-content';

/** The Get Started tour. Unconditional — every tenant has this route. The content draws its own loading state. */
export default function OnboardingPage() {
  return <OnboardingContent />;
}
