'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { useDeleteOwnAccount } from '../hooks/use-account-deletion';
import { NewOwnerSelect } from './new-owner/new-owner-select';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Confirm Deletion" modal for deleting your own account
 *
 * Two variants share one dialog, switched on `useOwnerGate`:
 * - regular user: warning copy + Cancel / "Delete Account";
 * - owner: the same copy plus an error banner and a mandatory "New Owner"
 *   select — the confirm becomes "Transfer & Delete Account" and stays
 *   disabled until a successor is chosen (the backend refuses to delete a
 *   user still holding OWNER).
 *
 * The mutation owns the aftermath (logout + redirect to /account-deleted), so
 * on success this modal never needs to close itself — the page under it is
 * replaced. While the gate is still 'loading' the confirm is disabled rather
 * than guessing a variant.
 */
export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const user = useAuthStore(state => state.user);
  const ownerGate = useOwnerGate();
  const deleteAccount = useDeleteOwnAccount();
  const [newOwnerId, setNewOwnerId] = useState('');

  const isOwner = ownerGate === 'owner';
  const organizationName = user?.organizationName || 'your organization';
  const isPending = deleteAccount.isPending;
  const canConfirm = ownerGate !== 'loading' && !isPending && (!isOwner || newOwnerId.length > 0);

  const handleConfirm = () => {
    deleteAccount.mutate({ newOwnerId: isOwner ? newOwnerId : undefined });
  };

  const handleClose = () => {
    if (isPending) return;
    setNewOwnerId('');
    onOpenChange(false);
  };

  return (
    <SimpleModal
      isOpen={open}
      onClose={handleClose}
      className="md:max-w-[600px]"
      title="Confirm Deletion"
      footer={
        <>
          <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={isPending}
          >
            {isOwner ? 'Transfer & Delete Account' : 'Delete Account'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)] text-left">
        <div className="flex flex-col gap-[var(--spacing-system-m)]">
          <p className="text-ods-text-primary text-h4">
            This will permanently delete your OpenFrame account and remove your access to {organizationName}.
          </p>
          <p className="text-ods-text-primary text-h4">
            Your personal information will be removed. Activity records stay in audit logs without your name.
          </p>
        </div>

        {isOwner && (
          <>
            <div className="flex items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-error p-[var(--spacing-system-m)]">
              <AlertTriangleIcon className="h-5 w-5 shrink-0 text-ods-error" />
              <p className="text-ods-error text-h5">
                You&apos;re the owner of organization. Choose who takes over ownership before your account is deleted.
              </p>
            </div>
            <NewOwnerSelect
              currentUserId={user?.id ?? ''}
              organizationName={organizationName}
              value={newOwnerId}
              onChange={setNewOwnerId}
              disabled={isPending}
            />
          </>
        )}
      </div>
    </SimpleModal>
  );
}
