'use client';

import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { stillRunningFor } from '../utils/check-messages';
import type { Check, CheckOverride } from '../utils/check-transform';

interface TurnOffCheckModalProps {
  check: Check;
  /** The check's exceptions, to name the ones that keep it running; null while they load. */
  overrides: readonly CheckOverride[] | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Turns the check off for every device without an exception that keeps it on. */
export function TurnOffCheckModal({ check, overrides, isPending, onClose, onConfirm }: TurnOffCheckModalProps) {
  return (
    <ConfirmDialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={`Turn Off ${check.name}?`}
      description={
        <span className="flex flex-col gap-[var(--spacing-system-m)]">
          <span>
            The check stops for every device without an exception that keeps it on.{stillRunningFor(overrides)}
          </span>
          <span className="text-ods-text-secondary">
            Measurements keep coming in; you can turn the check back on at any time.
          </span>
        </span>
      }
      confirmLabel="Turn Off"
      variant="default"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
