'use client';

import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core';
import { normalizeOSType } from '@flamingo-stack/openframe-frontend-core';
import {
  BracketCurlyIcon,
  PenEditIcon,
  Refresh01LeftIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useIsMobileShell } from '@/app/hooks/use-is-mobile-shell';
import { routes } from '@/lib/routes';
import { EditDisplayNameModal } from '../components/edit-display-name-modal';
import type { Device } from '../types/device.types';
import { type DeviceActionAvailability, getDeviceActionAvailability } from '../utils/device-action-utils';
import { buildDeviceMenuItems } from '../utils/device-menu-items';
import { useDeviceConfirmationDialogs } from './use-device-confirmation-dialogs';

const DEFAULT_ICON_SIZE = 'w-6 h-6';

interface UseDeviceActionsMenuOptions {
  onRunScript?: () => void;
  onActionComplete?: () => void;
  /** Used to build hrefs when `device` is still loading; falls back to device.machineId/id when omitted. */
  deviceId?: string;
  /** Tailwind classes for primary menu icons. Defaults to 'w-6 h-6'. */
  iconSize?: string;
  /** When true, after delete success also navigate to `/devices`. Composes with onActionComplete. */
  navigateOnDestructive?: boolean;
}

export interface DeviceActionsMenuItems {
  deviceDetails: ActionsMenuItem;
  remoteShell: ActionsMenuItem;
  /** Null in the mobile shell — see the `isMobileShell` note below. */
  remoteControl: ActionsMenuItem | null;
  manageFiles: ActionsMenuItem;
  runScript: ActionsMenuItem;
  /** Null on read-only archive records (DELETED / legacy ARCHIVED). */
  editDisplayName: ActionsMenuItem | null;
  reboot: ActionsMenuItem | null;
  deviceLogs: ActionsMenuItem;
  delete: ActionsMenuItem | null;
}

export interface UseDeviceActionsMenuResult {
  items: DeviceActionsMenuItems;
  dialogs: ReactNode;
  actionAvailability: DeviceActionAvailability | null;
}

export function useDeviceActionsMenu(
  device: Device | null | undefined,
  {
    onRunScript,
    onActionComplete,
    deviceId: deviceIdOverride,
    iconSize = DEFAULT_ICON_SIZE,
    navigateOnDestructive,
  }: UseDeviceActionsMenuOptions = {},
): UseDeviceActionsMenuResult {
  const router = useRouter();
  const isMobileShell = useIsMobileShell();
  const [showEditDisplayName, setShowEditDisplayName] = useState(false);

  const deviceId = deviceIdOverride || device?.machineId || device?.id || '';

  const handleDestructiveSuccess = useCallback(() => {
    onActionComplete?.();
    if (navigateOnDestructive) router.push(routes.devices.list);
  }, [onActionComplete, navigateOnDestructive, router]);

  const { openDelete, openReboot, dialogs, isRebooting } = useDeviceConfirmationDialogs(device, {
    onDeleted: handleDestructiveSuccess,
    onRebooted: onActionComplete,
  });

  const actionAvailability = useMemo(() => (device ? getDeviceActionAvailability(device) : null), [device]);

  const isWindows = useMemo(() => {
    if (!device) return undefined;
    const osType = device.platform || device.osType || device.operating_system;
    return normalizeOSType(osType) === 'WINDOWS';
  }, [device]);

  const runScriptHref = routes.devices.details(deviceId, { action: 'runScript' });

  const handleRunScript = useCallback(() => {
    if (onRunScript) {
      onRunScript();
    } else {
      router.push(runScriptHref);
    }
  }, [runScriptHref, onRunScript, router]);

  const items = useMemo<DeviceActionsMenuItems>(() => {
    const base = buildDeviceMenuItems({
      deviceId,
      availability: actionAvailability,
      iconSize: iconSize,
      isWindows,
      withNewTabAction: true,
    });

    const runScriptDisabled = !actionAvailability?.runScriptEnabled;
    // Run Script opens the run modal in place — no new-tab `iconAction` arrow.
    const runScript: ActionsMenuItem = {
      id: 'run-script',
      label: 'Run Script',
      icon: <BracketCurlyIcon className={`${iconSize} text-ods-text-secondary`} />,
      disabled: runScriptDisabled,
      onClick: handleRunScript,
    };

    const editDisplayName: ActionsMenuItem | null = actionAvailability?.editDisplayNameEnabled
      ? {
          id: 'edit-display-name',
          label: 'Edit Display Name',
          icon: <PenEditIcon className={`${iconSize} text-ods-text-secondary`} />,
          onClick: () => setShowEditDisplayName(true),
        }
      : null;

    const reboot: ActionsMenuItem | null = actionAvailability?.rebootEnabled
      ? {
          id: 'reboot',
          label: 'Reboot Device',
          icon: <Refresh01LeftIcon className={`${iconSize} text-ods-text-secondary`} />,
          disabled: isRebooting,
          onClick: openReboot,
        }
      : null;

    const deleteItem: ActionsMenuItem | null = actionAvailability?.deleteEnabled
      ? {
          id: 'delete',
          label: 'Delete Device',
          icon: <TrashIcon className={`${iconSize} text-ods-error`} />,
          onClick: openDelete,
        }
      : null;

    return {
      deviceDetails: base.deviceDetails,
      remoteShell: base.remoteShell,
      // The MeshCentral canvas is pointer-and-keyboard software — a remote desktop
      // scaled into a phone viewport, with no mouse, no modifier keys and no
      // Ctrl+Alt+Del. Dropping the item here (rather than disabling it) is what
      // removes every entry point at once: this hook feeds the devices table
      // dropdown, the device-details header buttons and the ticket-details menu.
      // The route itself redirects, for a restored URL that never passed through
      // a menu.
      remoteControl: isMobileShell ? null : base.remoteControl,
      manageFiles: base.manageFiles,
      runScript,
      editDisplayName,
      reboot,
      deviceLogs: base.deviceLogs,
      delete: deleteItem,
    };
  }, [
    deviceId,
    actionAvailability,
    isMobileShell,
    isWindows,
    iconSize,
    handleRunScript,
    openDelete,
    openReboot,
    isRebooting,
  ]);

  const allDialogs = (
    <>
      {dialogs}
      <EditDisplayNameModal
        isOpen={showEditDisplayName}
        onClose={() => setShowEditDisplayName(false)}
        device={device ?? null}
        onSaved={onActionComplete}
      />
    </>
  );

  return { items, dialogs: allDialogs, actionAvailability };
}
