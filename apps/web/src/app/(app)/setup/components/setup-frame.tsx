'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { PoweredByFlamingo } from '@/app/components/shared/powered-by-flamingo';
import { SETUP_TENANT_SCREENS, type SetupStep, setupProgressOf } from '../setup-steps';
import { DevSkipOnboardingButton } from './dev-skip-onboarding-button';
import { NeedHelpMenu } from './need-help-menu';

/**
 * The three-segment progress bar across the top of every wizard screen: one
 * segment per tenant step, painted done / current / pending.
 */
function SetupProgress({ step }: { step: SetupStep }) {
  const { done, current } = setupProgressOf(step);
  return (
    <div
      className="flex h-14 shrink-0 items-center justify-center gap-[var(--spacing-system-mf)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={SETUP_TENANT_SCREENS.length}
      aria-valuenow={done}
      aria-label="Setup progress"
    >
      {SETUP_TENANT_SCREENS.map((screen, index) => {
        const position = index + 1;
        const state = position <= done ? 'done' : position === current ? 'current' : 'pending';
        return (
          <span
            key={screen}
            className={cn(
              'h-2 w-12 rounded-full transition-colors',
              state === 'current' && 'bg-ods-accent',
              state === 'done' && 'bg-ods-accent opacity-50',
              state === 'pending' && 'bg-ods-border',
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * The wizard's page frame: progress bar, the screen centred in the remaining
 * height from the tablet step up (the phone reads from the top), and the
 * footer row with "Need Help?", the Flamingo credit and, on dev and QA, the
 * tester's "Skip onboarding (dev)". The bare app shell
 * around it already owns the viewport and the native insets. Each step keeps
 * its body at the design's 600px; the heading above it is wider.
 *
 * Window-chrome breakpoints (`sm:` / `md:`) on purpose: this page never renders
 * inside a content area, so there is no panel for `content-md:` to follow.
 */
export function SetupFrame({ step, children }: { step: SetupStep; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SetupProgress step={step} />
      <main className="flex flex-1 flex-col items-center justify-start px-[var(--spacing-system-l)] py-[var(--spacing-system-mf)] sm:justify-center sm:py-[var(--spacing-system-xl)]">
        <div className="flex w-full max-w-[990px] flex-col items-center gap-[var(--spacing-system-xl)]">{children}</div>
      </main>
      <footer className="relative flex h-14 shrink-0 items-center justify-center px-[var(--spacing-system-l)] sm:h-24">
        <div className="absolute left-[var(--spacing-system-l)]">
          <NeedHelpMenu />
        </div>
        <PoweredByFlamingo />
        <div className="absolute right-[var(--spacing-system-l)]">
          <DevSkipOnboardingButton />
        </div>
      </footer>
    </div>
  );
}
