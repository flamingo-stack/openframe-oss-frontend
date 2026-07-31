'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo, useState } from 'react';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import type { Device } from '../../../devices/types/device.types';
import { getDevicePrimaryId } from '../../utils/device-helpers';
import { testDeviceFilter } from '../../utils/script-utils';

export interface SelectedTestDevice {
  agentToolId: string;
  deviceName: string;
}

interface TestScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceSelected: (device: SelectedTestDevice) => void;
  supportedPlatforms: string[];
}

export function TestScriptModal({ isOpen, onClose, onDeviceSelected, supportedPlatforms }: TestScriptModalProps) {
  const { toast } = useToast();
  const [selection, setSelection] = useState<Device[]>([]);
  const selected = selection[0] ?? null;

  const hasPlatforms = supportedPlatforms.length > 0;

  const filter = useMemo(() => testDeviceFilter(supportedPlatforms), [supportedPlatforms]);

  const handleConfirm = useCallback(() => {
    if (!selected) {
      toast({ title: 'No device selected', description: 'Please select a device.', variant: 'destructive' });
      return;
    }

    // TODO(openframe-rmm): Tactical RMM removed — `agentToolId` was the Tactical agent id.
    // Fall back to the device primary id until the OpenFrame RMM test-run API is wired up
    // (the test run itself currently rejects — see use-test-runs.ts).
    onDeviceSelected({
      agentToolId: getDevicePrimaryId(selected),
      deviceName: selected.displayName || selected.hostname,
    });
    setSelection([]);
    onClose();
  }, [selected, toast, onDeviceSelected, onClose]);

  const handleClose = useCallback(() => {
    setSelection([]);
    onClose();
  }, [onClose]);

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-6xl h-[90vh] max-h-[900px]"
      title="Select Device"
      contentClassName=""
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleConfirm} disabled={!selected}>
            Select Device
          </Button>
        </>
      }
    >
      {!hasPlatforms ? (
        <div className="flex items-center justify-center h-64 bg-ods-card border border-ods-border rounded-[6px]">
          <p className="text-ods-text-secondary">Select at least one supported platform to see available devices.</p>
        </div>
      ) : (
        // Mounted only while open, which is what the old `enabled: isOpen` did —
        // a Relay query runs because its component is rendered.
        isOpen && (
          <DeviceListPicker
            filter={filter}
            selected={selection}
            onSelectionChange={setSelection}
            getDeviceKey={getDevicePrimaryId}
            showSelectionModeRadio={false}
            addAllBehavior="replace"
            singleSelect
          />
        )
      )}
    </SimpleModal>
  );
}
