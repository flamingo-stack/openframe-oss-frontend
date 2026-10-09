'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { PoweredByFlamingo } from '@/app/components/shared/powered-by-flamingo';
import { SETUP_TENANT_SCREENS, type SetupStep, setupProgressOf } from '../setup-steps';
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
 * height, and the footer row with "Need Help?" and the Flamingo credit. The
 * bare app shell around it already owns the viewport and the native insets.
 *
 * Window-chrome breakpoints (`md:`) on purpose: this page never renders inside
 * a content area, so there is no panel for `content-md:` to follow.
 */
export function SetupFrame({ step, children }: { step: SetupStep; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SetupProgress step={step} />
      <main className="flex flex-1 flex-col items-center justify-start px-[var(--spacing-system-l)] py-[var(--spacing-system-xl)] md:justify-center">
        <div className="flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-xl)]">{children}</div>
      </main>
      <footer className="relative flex h-24 shrink-0 items-center justify-center px-[var(--spacing-system-l)]">
        <div className="absolute left-[var(--spacing-system-l)]">
          <NeedHelpMenu />
        </div>
        <PoweredByFlamingo />
      </footer>
    </div>
  );
}
