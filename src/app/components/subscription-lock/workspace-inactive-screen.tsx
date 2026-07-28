'use client';

import { LockAltIcon, Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback } from 'react';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';

/**
 * Lock screen shown in place of the app when the workspace is inactive AND the
 * payment UI is hidden for this build — the native app builds (`isBillingHidden()`,
 * see `billing-visibility.ts`).
 *
 * Deliberately carries NO plans, prices, "choose a plan"/"pay" CTA, or link to
 * an external purchase flow: App Store Review Guideline 3.1.1 treats any of
 * those as steering the user to a non-IAP purchasing mechanism. It states the
 * account state, points at the workspace administrator, and keeps the user out
 * of a dead end with a re-check and a sign-out action.
 */
export function WorkspaceInactiveScreen() {
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);

  // The lock state comes from the subscription query resolved in the app shell;
  // a full reload is the simplest way to re-resolve it once an admin has
  // restored access elsewhere.
  const handleRecheck = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center p-[var(--spacing-system-l)]">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)] text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary">
          <LockAltIcon className="size-8" />
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <h1 className="text-h2 text-ods-text-primary">Workspace access is inactive</h1>
          <p className="text-h4 text-ods-text-secondary">
            This OpenFrame workspace is not active at the moment, so its data isn&apos;t available here. Your workspace
            administrator can restore access for your team.
          </p>
        </div>

        <div className="flex w-full flex-col gap-[var(--spacing-system-s)] sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            onClick={handleRecheck}
            leftIcon={<Refresh01RightIcon className="size-6 text-ods-text-secondary" />}
          >
            Check Again
          </Button>
          <Button variant="outline" onClick={openLogoutConfirm}>
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
