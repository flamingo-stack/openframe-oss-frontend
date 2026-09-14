'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Alert,
  AlertDescription,
  Button,
  Label,
  ModalV2Title,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';

interface ApiKeyCreatedModalProps {
  isOpen: boolean;
  fullKey: string | null;
  onClose: () => void;
}

export function ApiKeyCreatedModal({ isOpen, fullKey, onClose }: ApiKeyCreatedModalProps) {
  const { copy, copied } = useCopyToClipboard({
    successDescription: 'API key copied to clipboard',
    errorDescription: 'Unable to copy API key',
  });
  const [localKey, setLocalKey] = useState('');

  // Held locally so the key stays on screen through the closing animation, after
  // the parent has already dropped it. Reconciled during render rather than in an
  // effect, which would blank the panel for a frame each time either input moved.
  const [lastInputs, setLastInputs] = useState({ isOpen, fullKey });
  if (isOpen !== lastInputs.isOpen || fullKey !== lastInputs.fullKey) {
    setLastInputs({ isOpen, fullKey });
    if (!isOpen) {
      setLocalKey('');
    } else if (fullKey) {
      setLocalKey(fullKey);
    }
  }

  if (!localKey) return null;

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-2xl"
      header={
        <>
          <ModalV2Title>API Key Created</ModalV2Title>
          <p className="mt-1 text-ods-text-secondary text-h6">Save your API key securely</p>
        </>
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => copy(localKey)}
            leftIcon={copied ? <CheckIcon className="h-4 w-4 text-ods-success" /> : <Copy02Icon className="h-4 w-4" />}
          >
            Copy API Key
          </Button>
          <Button onClick={onClose}>Continue</Button>
        </>
      }
    >
      <Alert className="border-ods-warning bg-ods-warning text-ods-text-on-accent">
        <AlertTriangleIcon className="h-5 w-5" />
        <AlertDescription>
          This is the only time you'll see the complete API key. Please copy it and store it securely.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>Your API Key</Label>
        <div className="rounded-lg border border-ods-border bg-ods-bg p-4">
          <code className="block break-all text-ods-text-primary text-code">{localKey}</code>
        </div>
      </div>
    </SimpleModal>
  );
}
