'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SimpleModal } from '@/app/components/shared/simple-modal';

interface ScriptRunningModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Navigates to the device's Agent Logs tab and closes the flow; absent while the feature is off. */
  onViewDeviceLogs?: () => void;
}

/**
 * Post-run confirmation shown after a script is dispatched to a device
 * (Scripts). Mirrors Figma `1:65393` — "Scripts Running" + a pointer to the
 * device logs, with Close / Device Logs actions.
 */
export function ScriptRunningModal({ isOpen, onClose, onViewDeviceLogs }: ScriptRunningModalProps) {
  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title="Scripts Running"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          {onViewDeviceLogs && (
            <Button variant="accent" onClick={onViewDeviceLogs} className="flex-1">
              Device Logs
            </Button>
          )}
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">
        {onViewDeviceLogs
          ? 'You can check the results in the device logs section.'
          : 'The script has been sent to the device.'}
      </p>
    </SimpleModal>
  );
}
