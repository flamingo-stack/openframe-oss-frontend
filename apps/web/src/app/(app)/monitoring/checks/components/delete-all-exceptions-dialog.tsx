'use client';

import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { deleteAllExceptionsSentence } from '../utils/check-messages';
import type { Check, CheckOverride } from '../utils/check-transform';

interface DeleteAllExceptionsDialogProps {
  check: Check;
  /** Named in the sentence; null while they load, when the count stands in. */
  overrides: readonly CheckOverride[] | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirms deleting every exception of the check: every device goes back to the default. */
export function DeleteAllExceptionsDialog({
  check,
  overrides,
  isPending,
  onClose,
  onConfirm,
}: DeleteAllExceptionsDialogProps) {
  return (
    <ConfirmDialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Delete All Exceptions?"
      description={deleteAllExceptionsSentence(check, overrides)}
      confirmLabel="Delete All"
      variant="default"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
