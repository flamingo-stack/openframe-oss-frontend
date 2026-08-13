'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useMutation } from 'react-relay';
import type { updateDeviceNicknameMutation as UpdateDeviceNicknameMutationType } from '@/__generated__/updateDeviceNicknameMutation.graphql';
import { updateDeviceNicknameMutation } from '@/graphql/devices/update-device-nickname-mutation';
import { apiClient } from '@/lib/api-client';
import { DEVICE_STATUS } from '../constants/device-statuses';
import { invalidateDeviceQueries } from '../utils/query-keys';

interface UseDeviceActionsOptions {
  onSuccess?: () => void;
}

export function useDeviceActions(options?: UseDeviceActionsOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Every surface caching device data — lists (main / archive / customer tab),
  // pickers, detail views, filter facets, dashboard counters — must refresh
  // after a status mutation. The rule lives in `invalidateDeviceQueries`, next
  // to the key registry it invalidates.
  const invalidateDevices = useCallback(() => invalidateDeviceQueries(queryClient), [queryClient]);

  const archiveDevice = useCallback(
    async (deviceId: string, deviceName?: string): Promise<boolean> => {
      setIsArchiving(true);
      try {
        const response = await apiClient.patch(`/api/devices/${deviceId}`, {
          status: DEVICE_STATUS.ARCHIVED,
        });

        if (!response.ok) {
          throw new Error(response.error || 'Failed to archive device');
        }

        toast({
          title: 'Device archived',
          description: `${deviceName || deviceId} has been archived`,
        });

        invalidateDevices();
        options?.onSuccess?.();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to archive device';
        toast({
          title: 'Archive failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsArchiving(false);
      }
    },
    [toast, options, invalidateDevices],
  );

  // Restores an archived device. OFFLINE is the natural restore target: the
  // backend has no transition guards, and the agent heartbeat promotes the
  // device to ONLINE on its next check-in (PENDING means "never connected").
  const unarchiveDevice = useCallback(
    async (deviceId: string, deviceName?: string): Promise<boolean> => {
      setIsUnarchiving(true);
      try {
        const response = await apiClient.patch(`/api/devices/${deviceId}`, {
          status: DEVICE_STATUS.OFFLINE,
        });

        if (!response.ok) {
          throw new Error(response.error || 'Failed to unarchive device');
        }

        toast({
          title: 'Device unarchived',
          description: `${deviceName || deviceId} has been restored`,
        });

        invalidateDevices();
        options?.onSuccess?.();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to unarchive device';
        toast({
          title: 'Unarchive failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsUnarchiving(false);
      }
    },
    [toast, options, invalidateDevices],
  );

  const deleteDevice = useCallback(
    async (deviceId: string, deviceName?: string): Promise<boolean> => {
      setIsDeleting(true);
      try {
        const response = await apiClient.patch(`/api/devices/${deviceId}`, {
          status: DEVICE_STATUS.DELETED,
        });

        if (!response.ok) {
          throw new Error(response.error || 'Failed to delete device');
        }

        toast({
          title: 'Device deleted',
          description: `${deviceName || deviceId} has been deleted`,
        });

        invalidateDevices();
        options?.onSuccess?.();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete device';
        toast({
          title: 'Delete failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [toast, options, invalidateDevices],
  );

  const [commitUpdateNickname, isSavingNickname] =
    useMutation<UpdateDeviceNicknameMutationType>(updateDeviceNicknameMutation);

  // The mutation payload updates the Relay store in place (Machine is a Node),
  // so Relay-fed lists re-render on their own; the invalidation covers the
  // react-query surfaces (detail page, whole-fleet read, counters).
  const updateNickname = useCallback(
    (deviceId: string, nickname: string): Promise<boolean> =>
      new Promise(resolve => {
        const trimmed = nickname.trim();
        commitUpdateNickname({
          variables: { machineId: deviceId, nickname: trimmed.length > 0 ? trimmed : null },
          onCompleted: () => {
            toast({
              title: 'Display name updated',
              description: trimmed.length > 0 ? trimmed : 'Display name cleared',
              variant: 'success',
            });
            invalidateDevices();
            options?.onSuccess?.();
            resolve(true);
          },
          onError: error => {
            toast({
              title: 'Update failed',
              description: error instanceof Error ? error.message : 'Failed to update display name',
              variant: 'destructive',
            });
            resolve(false);
          },
        });
      }),
    [commitUpdateNickname, toast, options, invalidateDevices],
  );

  return {
    archiveDevice,
    unarchiveDevice,
    deleteDevice,
    updateNickname,
    isArchiving,
    isUnarchiving,
    isDeleting,
    isSavingNickname,
    isProcessing: isArchiving || isUnarchiving || isDeleting || isSavingNickname,
  };
}
