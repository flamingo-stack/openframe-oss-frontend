'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback } from 'react';
import { LockScreenActions } from './lock-screen-actions';

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
 *   - anyone whose role cannot open billing, on any build — renewing is for the
 *     workspace owner and admins (`use-billing-access-gate.ts`).
 *
 * Renders inside the app shell's `<main>`, with the header and nav sidebar still
 * up (`disabled`, since nothing they lead to is reachable while the lock holds).
 * Hence `min-h-full` rather than `min-h-screen`: the three bands distribute over
 * the content area's height, not the viewport's. And hence NO `of-standalone-shell`
 * — the shell root owns the native safe-area insets, and declaring them here too
 * applies them twice.
 *
 * Deliberately carries NO plans, prices, "choose a plan"/"pay" CTA, or link to
 * an external purchase flow: App Store Review Guideline 3.1.1 treats any of
 * those as steering the user to a non-IAP purchasing mechanism. It states the
 * account state, points at who can act, and keeps the user out of a dead end
 * with a re-check plus the shared `LockScreenActions` — a sign-out, a way to
 * delete the account outright, and a support ticket. None of those names a
 * purchase, which is what makes the row safe to share with the native builds.
 *
 * The DEFAULT copy is the native one and is deliberately subscription-agnostic —
 * it stays well clear of that guideline by not naming a purchase at all. The
 * role-refusal case overrides it, because on web there is nothing to stay clear of
 * and "contact the owner or an admin about the subscription" is the actionable
 * message.
 */
export function WorkspaceInactiveScreen({ title, description }: WorkspaceInactiveScreenProps = {}) {
  // The lock state comes from the subscription query resolved in the app shell;
  // a full reload is the simplest way to re-resolve it once an admin has
  // restored access elsewhere.
  const handleRecheck = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="flex min-h-full flex-col items-center justify-between p-[var(--spacing-system-xl)]">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      <div className="flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-xl)]">
        <div className="flex flex-col gap-[var(--spacing-system-xs)] text-center">
          <h1 className="text-ods-text-primary text-h2">{title ?? 'Workspace access is inactive'}</h1>
          <p className="text-ods-text-secondary text-h4">
            {description ??
              "This OpenFrame workspace is not active at the moment, so its data isn't available here. Your workspace administrator can restore access for your team."}
          </p>
        </div>

        {/* Sign out, self-deletion and a support ticket, shared with the
              suspension screen — the actions that stay available when the remedy
              itself is someone else's. "Check Again" leads them because it is the
              one that belongs to THIS screen: this is the surface a user sits on
              while waiting for an admin to fix things elsewhere. */}
        <LockScreenActions
          className="flex w-full flex-col items-stretch gap-[var(--spacing-system-m)] sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center"
          leading={
            <Button variant="outline" leftIcon={<Refresh01RightIcon />} onClick={handleRecheck}>
              Check Again
            </Button>
          }
        />
      </div>

      <div className="flex flex-col items-center gap-[var(--spacing-system-xxs)]">
        <a
          href="https://flamingo.run"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[var(--spacing-system-xs)] rounded-md bg-transparent p-[var(--spacing-system-m)] text-ods-text-secondary transition-colors hover:bg-ods-bg-hover"
        >
          <span className="text-h6">Powered by</span>
          <FlamingoLogo className="h-5 w-5" fill="currentColor" />
          <span className="font-semibold text-code">Flamingo</span>
        </a>
      </div>
    </div>
  );
}
