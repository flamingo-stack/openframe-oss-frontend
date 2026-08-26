'use client';

import { type ReactNode, useCallback, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import type { Device } from '../types/device.types';
import { getDeviceActionAvailability } from '../utils/device-action-utils';
import { getDeviceName } from '../utils/device-name';
import { useDeviceActions } from './use-device-actions';
import { useRebootDevice } from './use-reboot-device';

interface UseDeviceConfirmationDialogsOptions {
  onDeleted?: () => void;
  onRebooted?: () => void;
}

interface UseDeviceConfirmationDialogsResult {
  openDelete: () => void;
  openReboot: () => void;
  dialogs: ReactNode;
  isDeleting: boolean;
  isRebooting: boolean;
}

export function useDeviceConfirmationDialogs(
  device: Device | null | undefined,
  { onDeleted, onRebooted }: UseDeviceConfirmationDialogsOptions = {},
): UseDeviceConfirmationDialogsResult {
  const { deleteDevice, isDeleting } = useDeviceActions();
  const { rebootDevice, isRebooting } = useRebootDevice();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);

  const deviceName = getDeviceName(device) || 'this device';
  const deviceId = device?.machineId || device?.id || '';

  const openDelete = useCallback(() => setShowDeleteConfirm(true), []);
  const openReboot = useCallback(() => setShowRebootConfirm(true), []);

  const handleDelete = useCallback(async () => {
    if (!device) return;
    const success = await deleteDevice(deviceId, deviceName);
    setShowDeleteConfirm(false);
    if (success) onDeleted?.();
  }, [deleteDevice, deviceId, deviceName, device, onDeleted]);

  const handleReboot = useCallback(async () => {
    const meshcentralAgentId = device ? getDeviceActionAvailability(device).meshcentralAgentId : undefined;
    if (!meshcentralAgentId) return;
    const success = await rebootDevice(meshcentralAgentId, deviceName);
    setShowRebootConfirm(false);
    if (success) onRebooted?.();
  }, [device, deviceName, rebootDevice, onRebooted]);

  const dialogs = (
    <>
      <ConfirmDialog
        open={showRebootConfirm}
        onOpenChange={setShowRebootConfirm}
        title="Reboot Device"
        description={
          <>
            Are you sure you want to reboot <span className="text-ods-accent font-medium">{deviceName}</span>? The
            device will be temporarily unavailable while it restarts.
          </>
        }
        confirmLabel="Reboot Device"
        variant="warning"
        isPending={isRebooting}
        onConfirm={handleReboot}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Device"
        description={
          <>
            OpenFrame will be uninstalled from <span className="text-ods-accent font-medium">{deviceName}</span> the
            next time the device comes online. The device will then move to the archive as a read-only record - bringing
            it back requires a new installation.
          </>
        }
        confirmLabel="Delete Device"
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );

  return {
    openDelete,
    openReboot,
    dialogs,
    isDeleting,
    isRebooting,
  };
}
