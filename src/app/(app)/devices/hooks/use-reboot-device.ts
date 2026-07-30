'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useState } from 'react';
import { MeshControlClient } from '@/lib/meshcentral/meshcentral-control';

/**
 * Reboots a device through MeshCentral's control socket (`poweraction` /
 * actiontype `reset`) — the same mechanism the Remote Desktop actions menu
 * uses. There is no GraphQL/REST reboot endpoint; the action requires the
 * device's MeshCentral agent id and an online agent.
 */
export function useRebootDevice() {
  const { toast } = useToast();
  const [isRebooting, setIsRebooting] = useState(false);

  const rebootDevice = useCallback(
    async (meshcentralAgentId: string, deviceName?: string): Promise<boolean> => {
      setIsRebooting(true);
      const client = new MeshControlClient();
      try {
        await client.powerAction(meshcentralAgentId, 'reset');

        toast({
          title: 'Reboot requested',
          description: `${deviceName || 'Device'} is restarting. It may be temporarily unavailable.`,
        });
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to reboot device';
        toast({
          title: 'Reboot failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return false;
      } finally {
        client.close();
        setIsRebooting(false);
      }
    },
    [toast],
  );

  return { rebootDevice, isRebooting };
}
