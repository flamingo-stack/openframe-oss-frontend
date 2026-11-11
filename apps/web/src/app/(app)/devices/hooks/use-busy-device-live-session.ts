'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { routes } from '@/lib/routes';
import { deviceQueryKeys } from '../utils/query-keys';
import { useRemoteSessionWatchGate } from './use-remote-session-watch-gate';
import { readLiveSessions } from './use-tenant-live-sessions';

/**
 * A device another technician is in: with Watch live on, Remote Control on it becomes watching that session. Once the
 * request is refused as busy (`busy`), the device's running session is looked up and the page is replaced by its live
 * session page. Answers whether the lookup is still out, so the busy screen waits for it, and stays false when there is
 * nothing to watch (Watch live off, no running session of another technician, a failed lookup): the busy screen then
 * shows as before.
 */
export function useBusyDeviceLiveSession(deviceId: string, busy: boolean): { looking: boolean } {
  const router = useRouter();
  const watchGate = useRemoteSessionWatchGate();
  const userId = useAuthStore(s => s.user?.id ?? null);
  const enabled = busy && watchGate === 'on';
  const filter = { deviceIds: [deviceId] };

  const { data, isPending } = useQuery({
    queryKey: [...deviceQueryKeys.tenantLiveSessions(filter), 'busy-device'],
    queryFn: enabled ? () => readLiveSessions(filter) : skipToken,
    retry: false,
    staleTime: 0,
  });

  const target = enabled ? (data?.find(row => row.live && row.technicianId !== userId)?.id ?? null) : null;
  useEffect(() => {
    if (target) router.replace(routes.devices.liveSession(target));
  }, [target, router]);

  return { looking: (busy && watchGate === 'loading') || (enabled && (isPending || target !== null)) };
}
