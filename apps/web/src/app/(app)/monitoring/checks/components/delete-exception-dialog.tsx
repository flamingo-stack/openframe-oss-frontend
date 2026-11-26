'use client';

import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { deleteExceptionSentence, NEXT_RUN_NOTE } from '../utils/check-messages';
import type { Check, CheckOverride } from '../utils/check-transform';

interface DeleteExceptionDialogProps {
  check: Check;
  override: CheckOverride;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirms deleting one exception: where its devices go back to. */
export function DeleteExceptionDialog({ check, override, isPending, onClose, onConfirm }: DeleteExceptionDialogProps) {
  return (
    <ConfirmDialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Delete Exception?"
      description={
        <span className="flex flex-col gap-[var(--spacing-system-m)]">
          <span>{deleteExceptionSentence(check, override)}</span>
          <span className="text-ods-text-secondary">{NEXT_RUN_NOTE}</span>
        </span>
      }
      confirmLabel="Delete"
      variant="default"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
