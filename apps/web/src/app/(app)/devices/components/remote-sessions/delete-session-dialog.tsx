'use client';

import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { formatDateTime } from '@/lib/format-date';

interface DeleteSessionDialogProps {
  /** ISO start of the session the dialog asks about; null while there is none. */
  startedAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}

/**
 * The confirm step before a remote session is deleted, from a list row or from
 * the recording page. The delete takes the whole session and nothing of it
 * comes back, so the copy says so.
 */
export function DeleteSessionDialog({ startedAt, open, onOpenChange, isPending, onConfirm }: DeleteSessionDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Session"
      description={
        <>
          Are you sure you want to delete the remote session from{' '}
          <span className="font-medium text-ods-accent">{startedAt ? formatDateTime(startedAt) : ''}</span>? Its
          recording and session data will be deleted and can&apos;t be restored.
        </>
      }
      confirmLabel="Delete Session"
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
