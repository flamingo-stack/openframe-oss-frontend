'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useMutation } from 'react-relay';
import type { updateDeviceNicknameMutation as UpdateDeviceNicknameMutationType } from '@/__generated__/updateDeviceNicknameMutation.graphql';
import { updateDeviceNicknameMutation } from '@/graphql/devices/update-device-nickname-mutation';
import { apiClient } from '@/lib/api-client';
import { invalidateDeviceQueries } from '../utils/query-keys';

interface UseDeviceActionsOptions {
  onSuccess?: () => void;
}

export function useDeviceActions(options?: UseDeviceActionsOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Every surface caching device data — lists (main / archive / customer tab),
  // pickers, detail views, filter facets, dashboard counters — must refresh
  // after a status mutation. The rule lives in `invalidateDeviceQueries`, next
  // to the key registry it invalidates.
  const invalidateDevices = useCallback(() => invalidateDeviceQueries(queryClient), [queryClient]);

  // Triggers a remote uninstall: the backend marks the device PENDING_DELETION
  // and the agent uninstalls itself the next time the device comes online. The
  // device stays visible in lists until the uninstall completes, then moves to
  // the archive as a read-only DELETED record — deletion is final, and bringing
  // the machine back requires a fresh agent installation.
  const deleteDevice = useCallback(
    async (deviceId: string, deviceName?: string): Promise<boolean> => {
      setIsDeleting(true);
      try {
        const response = await apiClient.post('/api/force/client/uninstall', {
          machineIds: [deviceId],
        });

        if (!response.ok) {
          throw new Error(response.error || 'Failed to delete device');
        }

        toast({
          title: 'Device deletion scheduled',
          description: `OpenFrame will be uninstalled from ${deviceName || deviceId} when it comes online`,
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
    deleteDevice,
    updateNickname,
    isDeleting,
    isSavingNickname,
    isProcessing: isDeleting || isSavingNickname,
  };
}
