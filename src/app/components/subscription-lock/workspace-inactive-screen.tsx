'use client';

import { Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback } from 'react';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';
import { LockedScreen } from '@/app/components/shared/locked-screen';

interface WorkspaceInactiveScreenProps {
  /** Overrides the default heading. See `SubscriptionLockContent`. */
  title?: string;
  /** Overrides the default body copy. */
  description?: string;
}

/**
 * Lock screen shown in place of the app when the workspace is inactive and the
 * viewer has no purchase flow to be sent to. Two callers, for two different
 * reasons (see `subscription-lock-content.tsx`):
 *   - the native app builds, where the payment UI is hidden for the whole build
 *     (`isBillingHidden()`, see `billing-visibility.ts`);
 *   - anyone who is not the workspace owner, on any build — renewing is owner-only.
 *
 * Deliberately carries NO plans, prices, "choose a plan"/"pay" CTA, or link to
 * an external purchase flow: App Store Review Guideline 3.1.1 treats any of
 * those as steering the user to a non-IAP purchasing mechanism. It states the
 * account state, points at who can act, and keeps the user out of a dead end
 * with a re-check and a sign-out action.
 *
 * The DEFAULT copy is the native one and is deliberately subscription-agnostic —
 * it stays well clear of that guideline by not naming a purchase at all. The
 * non-owner case overrides it, because on web there is nothing to stay clear of
 * and "contact the owner about the subscription" is the actionable message.
 */
export function WorkspaceInactiveScreen({ title, description }: WorkspaceInactiveScreenProps = {}) {
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);

  // The lock state comes from the subscription query resolved in the app shell;
  // a full reload is the simplest way to re-resolve it once an admin has
  // restored access elsewhere.
  const handleRecheck = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <LockedScreen
      title={title ?? 'Workspace access is inactive'}
      description={
        description ??
        "This OpenFrame workspace is not active at the moment, so its data isn't available here. Your workspace administrator can restore access for your team."
      }
      actions={
        <>
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
        </>
      }
    />
  );
}
