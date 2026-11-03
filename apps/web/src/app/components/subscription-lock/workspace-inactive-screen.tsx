'use client';

import type { ReactNode } from 'react';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { OpenframeLockup } from '@/app/components/shared/openframe-lockup';
import { PoweredByFlamingo } from '@/app/components/shared/powered-by-flamingo';
import { DeleteMyAccountLink, InactiveScreenActions } from './lock-screen-actions';

interface WorkspaceInactiveScreenProps {
  /** Overrides the default heading (the invoices screen's error fallback). */
  title?: string;
  /** Overrides the default body copy. */
  description?: string;
  /** The remedy, when this viewer has one from here — leads the action row. */
  action?: ReactNode;
  /**
   * The copy depends on something still being read (the viewer's role): the body copy draws its own skeleton.
   * Inside a loading scope it does so by itself.
   */
  loading?: boolean;
}

const DEFAULT_DESCRIPTION =
  "This OpenFrame workspace is not active at the moment, so its data isn't available here. Your workspace administrator can restore access for your team.";

/**
 * Lock screen shown in place of the app when the workspace is inactive and the
 * viewer has no purchase flow to be sent to. Two callers, for two different
 * reasons (see `subscription-lock-content.tsx`):
 *   - the mobile builds, where the payment UI is hidden for the whole build
 *     (`isBillingHidden()`, see `billing-visibility.ts`);
 *   - the desktop build, where billing is read-only: same screen, plus an
 *     `action` that opens the web app's billing page for those who may use it;
 *   - anyone whose role cannot open billing, on any build — renewing is for the
 *     workspace owner and admins (`use-billing-access-gate.ts`). They get the
 *     default copy too, as the design (1779:20200) has it: it names who can act,
 *     and a member has nothing to do with which billing state caused it.
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
 * with a re-check, a sign-out and, in the footer, a way to delete the account
 * outright. None of those names a purchase, which is what makes the screen safe
 * on the native builds. The DEFAULT copy is deliberately subscription-agnostic
 * for the same reason.
 */
export function WorkspaceInactiveScreen({ title, description, action, loading }: WorkspaceInactiveScreenProps = {}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-between p-[var(--spacing-system-xl)]">
      <OpenframeLockup />

      <div className="flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-xl)]">
        <div className="flex flex-col gap-[var(--spacing-system-xs)] text-center">
          <h1 className="text-ods-text-primary text-h2">{title ?? 'Workspace access is inactive'}</h1>
          <LoadingParagraph text={description ?? DEFAULT_DESCRIPTION} loading={loading} label="Checking your access" />
        </div>

        {/* The remedy, when there is one, then a re-check — this is the surface a
            user sits on while waiting for an admin to fix things elsewhere — and
            a sign-out. */}
        <InactiveScreenActions
          className="flex w-full flex-col items-stretch gap-[var(--spacing-system-m)] content-sm:w-auto content-sm:flex-row content-sm:flex-wrap content-sm:justify-center [&>button]:content-sm:min-w-40"
          leading={action}
        />
      </div>

      <div className="flex flex-col items-center gap-[var(--spacing-system-xs)]">
        <DeleteMyAccountLink />
        <PoweredByFlamingo />
      </div>
    </div>
  );
}
