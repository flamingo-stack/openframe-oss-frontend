'use client';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type React from 'react';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useDeviceActions } from '../hooks/use-device-actions';
import { useRemoteAccessApprovalGate } from '../hooks/use-remote-access-approval-gate';
import {
  useDeviceRemoteAccessMode,
  useOrganizationRemoteAccessMode,
  useSetDeviceRemoteAccessMode,
  useTenantRemoteAccessPolicy,
} from '../hooks/use-remote-access-policy';
import type { Device } from '../types/device.types';
import { REMOTE_ACCESS_MODE_META, REMOTE_ACCESS_MODES, type RemoteAccessMode } from '../types/remote-access';

interface EditDisplayNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device | null;
  onSaved?: () => void;
}

/** Select sentinel for "no per-device override - inherit customer/tenant". */
const DEFAULT_MODE_VALUE = 'DEFAULT';

/**
 * "Edit Device" modal: sets or clears a device's user-defined name (the BE
 * `nickname`, labeled "Display Name" in the UI per the design) and - with the
 * remote-access-approval gate on - the per-device Remote Access Permission
 * override (CU-86akeqw8b). Clearing the name reverts the title to the
 * agent-reported displayName/hostname.
 */
export function EditDisplayNameModal({ isOpen, onClose, device, onSaved }: EditDisplayNameModalProps) {
  const { toast } = useToast();
  const { updateNickname, isSavingNickname } = useDeviceActions();
  const [name, setName] = useState('');

  const currentName = device?.nickname ?? '';
  const deviceId = device?.machineId || device?.id || '';

  const showRemoteAccess = useRemoteAccessApprovalGate() === 'on';
  const deviceMode = useDeviceRemoteAccessMode(deviceId, { enabled: isOpen && showRemoteAccess });
  const organizationMode = useOrganizationRemoteAccessMode(device?.organizationId ?? '', {
    enabled: isOpen && showRemoteAccess,
  });
  const tenantPolicy = useTenantRemoteAccessPolicy({ enabled: isOpen && showRemoteAccess });
  const { mutateAsync: setDeviceMode, isPending: isSavingMode } = useSetDeviceRemoteAccessMode();

  // The select shows the loaded override until the user picks something, so a
  // background refetch can't overwrite an in-progress choice.
  const [pickedMode, setPickedMode] = useState<RemoteAccessMode | typeof DEFAULT_MODE_VALUE | null>(null);

  // Seeded when the modal opens, during render rather than in an effect: an effect
  // paints the field with the previous value once before correcting it. Keyed off
  // the open transition alone, so a background refresh of the source value can no
  // longer overwrite what the user has typed while the modal is up.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setName(currentName);
      setPickedMode(null);
    }
  }

  const savedModeValue: RemoteAccessMode | typeof DEFAULT_MODE_VALUE = deviceMode.data ?? DEFAULT_MODE_VALUE;
  const selectedModeValue = pickedMode ?? savedModeValue;
  const modeChanged = showRemoteAccess && !deviceMode.isLoading && selectedModeValue !== savedModeValue;
  // What the device inherits while no override is set: org override -> tenant default.
  const inheritedMode: RemoteAccessMode | undefined = organizationMode.data ?? tenantPolicy.data?.mode ?? undefined;

  const isSaving = isSavingNickname || isSavingMode;
  const trimmed = name.trim();
  const nameChanged = trimmed !== currentName.trim();
  // Allow clearing the name (revert to hostname); only block no-op saves.
  const canSubmit = !!deviceId && (nameChanged || modeChanged) && !isSaving;

  const handleSubmit = async () => {
    if (!device || !canSubmit) return;

    if (modeChanged) {
      try {
        await setDeviceMode({
          deviceId,
          mode: selectedModeValue === DEFAULT_MODE_VALUE ? null : selectedModeValue,
        });
      } catch (err) {
        toast({
          title: 'Save failed',
          description: err instanceof Error ? err.message : 'Failed to update the remote access permission',
          variant: 'destructive',
        });
        return;
      }
    }

    if (nameChanged) {
      // updateNickname owns its own success/error toasts.
      const success = await updateNickname(deviceId, trimmed);
      if (!success) return;
    } else {
      toast({ title: 'Saved', description: 'Remote access permission updated', variant: 'success' });
    }

    onSaved?.();
    onClose();
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
      title={showRemoteAccess ? 'Edit Device' : 'Device Display Name'}
      // Single column per the updated mockup (784-118168): stacked full-width fields.
      contentClassName="flex flex-col gap-[var(--spacing-system-mf)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit} loading={isSaving}>
            {isSaving ? 'Saving...' : showRemoteAccess ? 'Save Device' : 'Save Display Name'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <Label htmlFor="device-display-name" className="text-ods-text-primary text-h4">
          Display Name
        </Label>
        <Input
          id="device-display-name"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          // The agent-reported name: what the device is called while no custom
          // name is set (and what an emptied field reverts it to).
          placeholder={device?.displayName || device?.hostname || 'Enter Device Display Name'}
          disabled={isSaving}
          autoFocus
        />
      </div>

      {showRemoteAccess && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Label className="text-ods-text-primary text-h4">Remote Access Permission</Label>
          <Select
            value={selectedModeValue}
            onValueChange={value => setPickedMode(value as RemoteAccessMode | typeof DEFAULT_MODE_VALUE)}
            disabled={isSaving || deviceMode.isLoading}
          >
            <SelectTrigger>
              {/* Children override Radix's default item mirror: the closed
                  trigger shows only the label, without the description line. */}
              <SelectValue placeholder="Select a permission">
                {selectedModeValue === DEFAULT_MODE_VALUE
                  ? inheritedMode
                    ? `Default (${REMOTE_ACCESS_MODE_META[inheritedMode].label})`
                    : 'Default'
                  : REMOTE_ACCESS_MODE_META[selectedModeValue].label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* Not in the 4-option mockup: without it a set override could never
                  be cleared back to inheritance. Flagged to the designer. */}
              <SelectItem value={DEFAULT_MODE_VALUE}>
                <span className="flex flex-col text-left">
                  <span>{inheritedMode ? `Default (${REMOTE_ACCESS_MODE_META[inheritedMode].label})` : 'Default'}</span>
                  <span className="text-ods-text-secondary text-h6">Inherited from customer or global settings.</span>
                </span>
              </SelectItem>
              {REMOTE_ACCESS_MODES.map(mode => (
                <SelectItem key={mode} value={mode}>
                  <span className="flex flex-col text-left">
                    <span>{REMOTE_ACCESS_MODE_META[mode].label}</span>
                    <span className="text-ods-text-secondary text-h6">{REMOTE_ACCESS_MODE_META[mode].description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </SimpleModal>
  );
}
