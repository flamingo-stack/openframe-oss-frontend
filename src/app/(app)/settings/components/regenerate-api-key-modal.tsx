'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';

interface RegenerateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyName?: string;
  onConfirm: () => Promise<void>;
}

export function RegenerateApiKeyModal({ isOpen, onClose, apiKeyName, onConfirm }: RegenerateApiKeyModalProps) {
  const [loading, setLoading] = useState(false);

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old value on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setLoading(false);
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      // `finally`, because a rejected `onConfirm` used to skip the reset and
      // leave the dialog stuck on "Regenerating…" with its confirm button dead —
      // recoverable only by closing the dialog (the effect above).
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Confirm Regeneration"
      description={
        <>
          Are you sure you want to regenerate{' '}
          <span className="font-semibold text-ods-warning">{apiKeyName || 'this API Key'}</span>? The current key will
          stop working immediately.
        </>
      }
      confirmLabel="Regenerate API Key"
      pendingLabel="Regenerating..."
      variant="warning"
      isPending={loading}
      onConfirm={handleConfirm}
    />
  );
}
