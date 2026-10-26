'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { MaximizeDesktopWindow } from '@/app/components/maximize-desktop-window';
import { SetupWelcomeFrame, SetupWizard } from './components/setup-wizard';

/**
 * The AI-first setup wizard (flag `onboarding-v2`): the tenant Initial Setup as
 * a full-screen walk - organization, first customer, first device - ending on the
 * handoff to the Mingo tour. The app shell renders this route bare (no header,
 * sidebar or panel), and `OnboardingV2Redirect` is what brings a session here
 * and sends it on. The wizard draws its own loading state while its progress is read.
 *
 * The desktop shell's window is maximized here too (it already is when the admin
 * came through sign-in): the wizard is drawn for a full screen, and the deploy
 * step's log needs the width.
 */
export default function SetupPage() {
  return (
    <>
      <MaximizeDesktopWindow />
      {/* The loading region is the one element between the bare shell's column and
          the frame: it has to be a filling column too, or the frame's `flex-1` has
          nothing to fill and the welcome screen sits at the top until the wizard loads. */}
      <LoadingSuspense label="Loading setup" className="flex flex-1 flex-col" fallback={<SetupWelcomeFrame />}>
        <SetupWizard />
      </LoadingSuspense>
    </>
  );
}
