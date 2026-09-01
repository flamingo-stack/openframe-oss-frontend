'use client';

import {
  HeadphoneIcon,
  Logout01Icon,
  UserXmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuGroup } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ActionsMenuDropdown, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  const { logOut, deleteAccount, contactSupport, modals } = useLockScreenActions();

  return (
    <>
      <div className={className ?? 'flex flex-col gap-[var(--spacing-system-mf)] sm:flex-row sm:flex-wrap'}>
        {leading}
        {/* All three glyphs carry the error red per the design — these are the
            exits, and the row reads as one. The LABELS stay primary: an outline
            button whose text went red would read as three destructive actions,
            and only one of them is. */}
        <Button variant="outline" leftIcon={<Logout01Icon className="text-ods-error" />} onClick={logOut}>
          Log Out
        </Button>
        <Button variant="outline" leftIcon={<UserXmarkIcon className="text-ods-error" />} onClick={deleteAccount}>
          Delete Account
        </Button>
        <Button variant="outline" leftIcon={<HeadphoneIcon className="text-ods-error" />} onClick={contactSupport}>
          Contact Support
        </Button>
      </div>
      {modals}
    </>
  );
}

/**
 * The same three exits as a "…" menu, for the lock screen that has a page title
 * to hang one off: the paywall.
 *
 * The paywall cannot take the button row above it — that screen's own primary
 * action is "Proceed to Payment", and three outline buttons of equal weight
 * beside it argue with it. The row belongs to the screens with nothing else to
 * do (`WorkspaceInactiveScreen`, `UnpaidInvoicesScreen`); here the exits sit in
 * the header, out of the way of the thing the user came to do, which is pay.
 *
 * Only Delete Account is `danger`. The button row makes the same distinction
 * with its glyphs — logging out and writing to support are not destructive, and
 * three red rows would say they are.
 */
export function LockScreenActionsMenu({ triggerClassName }: { triggerClassName?: string }) {
  const { logOut, deleteAccount, contactSupport, modals } = useLockScreenActions();

  const groups: ActionsMenuGroup[] = [
    {
      items: [
        {
          id: 'log-out',
          label: 'Log Out',
          icon: <Logout01Icon className="w-6 h-6 text-ods-text-secondary" />,
          onClick: logOut,
        },
        {
          id: 'contact-support',
          label: 'Contact Support',
          icon: <HeadphoneIcon className="w-6 h-6 text-ods-text-secondary" />,
          onClick: contactSupport,
        },
        {
          id: 'delete-account',
          // No color class — `danger` paints label and icon via currentColor.
          icon: <UserXmarkIcon className="w-6 h-6" />,
          label: 'Delete Account',
          danger: true,
          onClick: deleteAccount,
        },
      ],
    },
  ];

  return (
    <>
      {/* `triggerClassName`, not `className`: the trigger button is the flex child
          on the paywall's title row, and `className` styles the dropdown content. */}
      <ActionsMenuDropdown
        groups={groups}
        align="end"
        triggerAriaLabel="Account actions"
        triggerClassName={triggerClassName}
      />
      {modals}
    </>
  );
}

/**
 * The three actions and the two modals behind them, shared by both
 * presentations. A hook rather than one component with a `variant`: the row and
 * the menu have nothing in common visually, and the only thing worth sharing is
 * exactly this — which handler opens what, and the modals that must be mounted
 * for them.
 */
function useLockScreenActions() {
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  return {
    logOut: openLogoutConfirm,
    deleteAccount: () => setDeleteAccountOpen(true),
    contactSupport: () => setSupportOpen(true),
    /** Mount these wherever the actions are rendered — both are controlled. */
    modals: (
      <>
        <DeleteAccountModal open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
        <ContactSupportModal open={supportOpen} onOpenChange={setSupportOpen} />
      </>
    ),
  };
}
