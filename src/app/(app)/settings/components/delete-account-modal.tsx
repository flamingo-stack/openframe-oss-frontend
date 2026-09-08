'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SquareAvatar,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { getFullImageUrl } from '@/lib/image-url';
import { useDeleteOwnAccount } from '../hooks/use-account-deletion';
import { UserStatus, useUsers } from '../hooks/use-users';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NewOwnerSelectProps {
  currentUserId: string;
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

/**
 * "New Owner" picker for the owner variant. A separate component so the users
 * request fires only while the owner actually has the modal open — it mounts
 * conditionally from the parent. Candidates are ACTIVE users other than the
 * caller; DELETED users and pending invitations can't receive the OWNER role.
 */
function NewOwnerSelect({ currentUserId, value, onChange, disabled }: NewOwnerSelectProps) {
  const { users, isLoading } = useUsers(0, 1000);
  const candidates = users.filter(u => u.id !== currentUserId && u.status === UserStatus.Active);

  const placeholder = isLoading
    ? 'Loading users...'
    : candidates.length === 0
      ? 'No active users to transfer to'
      : 'Select new owner';

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xs)]">
      <Label htmlFor="new-owner-select">New Owner</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || candidates.length === 0}>
        <SelectTrigger id="new-owner-select">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {candidates.map(candidate => {
            const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email;
            return (
              <SelectItem key={candidate.id} value={candidate.id}>
                <span className="flex items-center gap-[var(--spacing-system-xs)]">
                  <SquareAvatar
                    src={getFullImageUrl(candidate.image?.imageUrl, candidate.image?.hash)}
                    fallback={name}
                    size="sm"
                    variant="round"
                  />
                  {name}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
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
