'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { fetchUsers, UserStatus } from '../hooks/use-users';

interface DisableOpenframeSsoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation for switching the built-in OpenFrame login off for the whole
 * tenant. The affected-user count is best-effort — the dialog reads the same
 * without it.
 */
export function DisableOpenframeSsoModal({ open, onOpenChange, isPending, onConfirm }: DisableOpenframeSsoModalProps) {
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchUsers(0, 1000)
      .then(page => {
        if (cancelled) return;
        const activeCount = page.items?.filter(user => user.status === UserStatus.Active).length ?? 0;
        // Past the first page the active filter undercounts — the raw total is closer.
        setUserCount(page.totalElements > (page.items?.length ?? 0) ? page.totalElements : activeCount);
      })
      .catch(() => {
        if (!cancelled) setUserCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const description =
    userCount === null
      ? 'Users will switch to signing in through SSO providers.'
      : `${userCount} ${userCount === 1 ? 'user' : 'users'} will switch to signing in through SSO providers.`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Disable OpenFrame SSO"
      description={description}
      confirmLabel="Disable Configuration"
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
      extraContent={
        <div className="flex flex-col gap-[var(--spacing-system-s)]">
          <div className="flex items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-warning bg-ods-card p-[var(--spacing-system-s)]">
            <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
            <p className="flex-1 text-h6 text-ods-warning">
              If a connected SSO provider stops working, nobody in this tenant can sign in, including you. Support can
              switch OpenFrame SSO back on from the admin console.
            </p>
          </div>
          <p className="text-h4 text-ods-text-primary">
            Current sessions stay active. At their next login, users will sign in through an SSO provider instead of an
            OpenFrame password.
          </p>
        </div>
      }
    />
  );
}
