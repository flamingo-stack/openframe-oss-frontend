'use client';

import {
  Button,
  ColorSwatch,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import type { ReplacementOption } from '../hooks/use-ticket-statuses-form';

interface DeleteStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  statusName: string;
  options: ReplacementOption[];
  onConfirm: (replacementStatusId: string) => void;
  isPending: boolean;
}

export function DeleteStatusDialog({
  isOpen,
  onClose,
  statusName,
  options,
  onConfirm,
  isPending,
}: DeleteStatusDialogProps) {
  const [replacementId, setReplacementId] = useState('');

  // Seeded via an effect keyed on the open transition (and kept in sync with the
  // latest options while open), so a background refresh of the source value
  // cannot leave the field referencing a stale/removed status id.
  useEffect(() => {
    if (isOpen) setReplacementId(options[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const canConfirm = replacementId.length > 0 && !isPending;

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="md:max-w-[480px]"
      title="Delete Status"
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => onConfirm(replacementId)}
            disabled={!canConfirm}
            loading={isPending}
          >
            Delete
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">
        Tickets currently in &ldquo;{statusName}&rdquo; will be reassigned to the status you select below before it is
        deleted.
      </p>

      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <Label>Reassign tickets to</Label>
        <Select value={replacementId} onValueChange={setReplacementId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>
                <span className="flex items-center gap-[var(--spacing-system-xs)]">
                  <ColorSwatch color={opt.color} />
                  {opt.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SimpleModal>
  );
}
