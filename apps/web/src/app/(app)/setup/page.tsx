'use client';

import { Suspense } from 'react';
import { SetupWizard, SetupWizardPending } from './components/setup-wizard';

/**
 * The AI-first setup wizard (flag `onboarding-v2`): the tenant Initial Setup as
 * a full-screen walk - organization, first customer, first device - ending on the
 * handoff to the Mingo tour. The app shell renders this route bare (no header,
 * sidebar or panel), and `OnboardingV2Redirect` is what brings a session here
 * and sends it on. The wizard draws its own loading state while its progress is read.
 */
export default function SetupPage() {
  return (
    <Suspense fallback={<SetupWizardPending />}>
      <SetupWizard />
    </Suspense>
  );
}
