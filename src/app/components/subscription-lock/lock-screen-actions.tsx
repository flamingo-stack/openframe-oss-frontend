'use client';

import {
  HeadphoneIcon,
  Logout01Icon,
  UserXmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useState } from 'react';
import { DeleteAccountModal } from '@/app/(app)/settings/components/delete-account-modal';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';
import { ContactSupportModal } from '@/app/components/shared/contact-support-modal';

interface LockScreenActionsProps {
  /** Rendered before the standard three — e.g. the inactive screen's "Check Again". */
  leading?: ReactNode;
  className?: string;
}

/**
 * The three things left to a user whose workspace will not open: leave it, leave
 * the product, or ask a human.
 *
 * Shared by every lock screen, and deliberately role-blind — these are the
 * actions that stay available when the remedy itself is not. A member who cannot
 * touch billing gets exactly this row and nothing about plans or invoices; an
 * owner gets it under the invoice list. Which of those two screens renders is
 * decided in `subscription-plan-lock-content.tsx`.
 *
 * Self-deletion is here because without it the only way out of a dead tenant is
 * to write to support — and `DeleteAccountModal` already covers both roles
 * (an owner must hand the workspace over first, a member just leaves).
 *
 * The logout confirmation is NOT mounted here: it lives above the lock/shell
 * branch in `AppLayoutInner`, because this row renders on the side of that
 * branch where the shell does not exist.
 *
 * Carries no payment surface of any kind, so it is safe on the native builds too
 * (App Store Guideline 3.1.1 — see `billing-visibility.ts`).
 */
export function LockScreenActions({ leading, className }: LockScreenActionsProps) {
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <div className={className ?? 'flex flex-col gap-[var(--spacing-system-mf)] sm:flex-row sm:flex-wrap'}>
        {leading}
        {/* All three glyphs carry the error red per the design — these are the
            exits, and the row reads as one. The LABELS stay primary: an outline
            button whose text went red would read as three destructive actions,
            and only one of them is. */}
        <Button variant="outline" leftIcon={<Logout01Icon className="text-ods-error" />} onClick={openLogoutConfirm}>
          Log Out
        </Button>
        <Button
          variant="outline"
          leftIcon={<UserXmarkIcon className="text-ods-error" />}
          onClick={() => setDeleteAccountOpen(true)}
        >
          Delete Account
        </Button>
        <Button
          variant="outline"
          leftIcon={<HeadphoneIcon className="text-ods-error" />}
          onClick={() => setSupportOpen(true)}
        >
          Contact Support
        </Button>
      </div>

      <DeleteAccountModal open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
      <ContactSupportModal open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}
