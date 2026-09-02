'use client';

import { Button, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useDeviceActions } from '../hooks/use-device-actions';
import type { Device } from '../types/device.types';

interface EditDisplayNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device | null;
  onSaved?: () => void;
}

/**
 * Sets or clears a device's user-defined name (the BE `nickname`, labeled
 * "Display Name" in the UI per the design). Clearing reverts the title to
 * the agent-reported displayName/hostname.
 */
export function EditDisplayNameModal({ isOpen, onClose, device, onSaved }: EditDisplayNameModalProps) {
  const { updateNickname, isSavingNickname } = useDeviceActions();
  const [name, setName] = useState('');

  const currentName = device?.nickname ?? '';

  // Seeded when the modal opens, during render rather than in an effect: an effect
  // paints the field with the previous value once before correcting it. Keyed off
  // the open transition alone, so a background refresh of the source value can no
  // longer overwrite what the user has typed while the modal is up.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setName(currentName);
  }

  const deviceId = device?.machineId || device?.id || '';
  const trimmed = name.trim();
  // Allow clearing the name (revert to hostname); only block no-op saves.
  const canSubmit = !!deviceId && trimmed !== currentName.trim() && !isSavingNickname;

  const handleSubmit = async () => {
    if (!device || !canSubmit) return;
    const success = await updateNickname(deviceId, trimmed);
    if (success) {
      onSaved?.();
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSubmit) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      // text-left: the modal renders in place (no portal), and in the table it
      // mounts inside the actions cell, which sets text-right on its subtree.
      className="max-w-[600px] text-left"
      title="Device Display Name"
      contentClassName="flex flex-col gap-[var(--spacing-system-xxs)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSavingNickname}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit} loading={isSavingNickname}>
            {isSavingNickname ? 'Saving...' : 'Save Display Name'}
          </Button>
        </>
      }
    >
      <Label htmlFor="device-display-name" className="text-ods-text-primary text-h4">
        Display Name
      </Label>
      <Input
        id="device-display-name"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter Device Display Name"
        disabled={isSavingNickname}
        autoFocus
      />
    </SimpleModal>
  );
}
