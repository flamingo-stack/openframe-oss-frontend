'use client';

import {
  Button,
  ModalV2,
  ModalV2Content,
  ModalV2Footer,
  ModalV2Header,
  ModalV2Title,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo, useState } from 'react';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import type { Device } from '../../../../devices/types/device.types';
import { getDevicePrimaryId } from '../../../utils/device-helpers';
import { testDeviceFilter } from '../../../utils/script-utils';

export interface SelectedTestDevice {
  machineId: string;
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

    if (!selected.machineId) {
      toast({
        title: 'No machine ID',
        description: 'This device has no machine ID and cannot run a test.',
        variant: 'destructive',
      });
      return;
    }

    onDeviceSelected({
      machineId: selected.machineId,
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
    <ModalV2 isOpen={isOpen} onClose={handleClose} className="max-w-6xl h-[90vh] max-h-[900px]">
      <ModalV2Header>
        <ModalV2Title>Select Device</ModalV2Title>
      </ModalV2Header>
      <ModalV2Content>
        {!hasPlatforms ? (
          <div className="flex items-center justify-center h-64 bg-ods-card border border-ods-border rounded-[6px]">
            <p className="text-ods-text-secondary">Select at least one supported platform to see available devices.</p>
          </div>
        ) : (
          // Mounted only while open, which is what the old `enabled: isOpen`
          // did — a Relay query runs because its component is rendered.
          isOpen && (
            <DeviceListPicker
              filter={filter}
              selected={selection}
              onSelectionChange={setSelection}
              getDeviceKey={getDevicePrimaryId}
              showSelectionModeRadio={false}
              addAllBehavior="replace"
              singleSelect
              isDeviceDisabled={(d: Device) => (!d.machineId ? 'Agent is not\nconnected' : undefined)}
            />
          )
        )}
      </ModalV2Content>
      <ModalV2Footer className="justify-end">
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleConfirm} disabled={!selected}>
            Select Device
          </Button>
        </div>
      </ModalV2Footer>
    </ModalV2>
  );
}
