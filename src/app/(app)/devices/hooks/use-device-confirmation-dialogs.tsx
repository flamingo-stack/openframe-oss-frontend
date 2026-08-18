'use client';

import { type ReactNode, useCallback, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import type { Device } from '../types/device.types';
import { getDeviceActionAvailability } from '../utils/device-action-utils';
import { getDeviceName } from '../utils/device-name';
import { useDeviceActions } from './use-device-actions';
import { useRebootDevice } from './use-reboot-device';

interface UseDeviceConfirmationDialogsOptions {
  onArchived?: () => void;
  onDeleted?: () => void;
  onRebooted?: () => void;
}

interface UseDeviceConfirmationDialogsResult {
  openArchive: () => void;
  openDelete: () => void;
  openReboot: () => void;
  dialogs: ReactNode;
  isArchiving: boolean;
  isDeleting: boolean;
  isRebooting: boolean;
  /** Re-exported from the hook's internal useDeviceActions instance so callers
   *  (e.g. useDeviceActionsMenu) don't have to instantiate a second one. */
  unarchiveDevice: (deviceId: string, deviceName?: string) => Promise<boolean>;
  isUnarchiving: boolean;
}

export function useDeviceConfirmationDialogs(
  device: Device | null | undefined,
  { onArchived, onDeleted, onRebooted }: UseDeviceConfirmationDialogsOptions = {},
): UseDeviceConfirmationDialogsResult {
  const { archiveDevice, unarchiveDevice, deleteDevice, isArchiving, isUnarchiving, isDeleting } = useDeviceActions();
  const { rebootDevice, isRebooting } = useRebootDevice();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);

  const deviceName = getDeviceName(device) || 'this device';
  const deviceId = device?.machineId || device?.id || '';

  const openArchive = useCallback(() => setShowArchiveConfirm(true), []);
  const openDelete = useCallback(() => setShowDeleteConfirm(true), []);
  const openReboot = useCallback(() => setShowRebootConfirm(true), []);

  const handleArchive = useCallback(async () => {
    if (!device) return;
    const success = await archiveDevice(deviceId, deviceName);
    setShowArchiveConfirm(false);
    if (success) onArchived?.();
  }, [archiveDevice, deviceId, deviceName, device, onArchived]);

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
        open={showArchiveConfirm}
        onOpenChange={setShowArchiveConfirm}
        title="Archive Device"
        description={
          <>
            Are you sure you want to archive <span className="text-ods-accent font-medium">{deviceName}</span>? This
            device will be hidden from the default view but can be restored later.
          </>
        }
        confirmLabel="Archive Device"
        pendingLabel="Archiving..."
        variant="default"
        isPending={isArchiving}
        onConfirm={handleArchive}
      />

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
            next time the device comes online. The device will remain visible until the uninstall completes.
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
    openArchive,
    openDelete,
    openReboot,
    dialogs,
    isArchiving,
    isDeleting,
    isRebooting,
    unarchiveDevice,
    isUnarchiving,
  };
}
