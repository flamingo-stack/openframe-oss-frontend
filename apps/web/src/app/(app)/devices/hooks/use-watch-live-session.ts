'use client';

import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import type { RecordingSummary } from '../types/session-recording';
import { useRemoteSessionWatchGate } from './use-remote-session-watch-gate';
import { type TenantLiveSessionsFilter, useTenantLiveSessions } from './use-tenant-live-sessions';

/**
 * A running session another technician holds: what this technician can watch instead of opening a Remote Control of
 * their own. Their own running session is not one (Remote Control takes them back to it). The one rule behind both
 * the device's "Watch live" action and the busy-device redirect.
 */
export function isWatchableSession(
  row: Pick<RecordingSummary, 'live' | 'technicianId'>,
  userId: string | null,
): boolean {
  return row.live && row.technicianId !== userId;
}

/** Every running session in the tenant: one read that every row of a device table shares (one react-query key). */
const TENANT_WIDE: TenantLiveSessionsFilter = {};

/**
 * The session to watch on `deviceId`, polled with the running sessions (every 10 s while the tab is visible), or
 * null: Watch live off or still loading, `enabled` false, nothing running, or only this technician's own session.
 *
 * `scope` picks the read, so the poll stays where the action shows and costs one request per tab:
 * - `device`: a page about one device (its header, a ticket's device menu) reads that device's running sessions;
 * - `tenant`: the rows of a device table share one read of the tenant's running sessions. It returns at most 100;
 *   a device past them keeps "Remote Control", and its click still reaches the live page through the busy-device
 *   redirect.
 */
export function useWatchLiveSessionId(
  deviceId: string,
  { scope, enabled }: { scope: 'device' | 'tenant'; enabled: boolean },
): string | null {
  const gate = useRemoteSessionWatchGate();
  const userId = useAuthStore(s => s.user?.id ?? null);
  const reads = enabled && gate === 'on' && deviceId !== '';
  const rows = useTenantLiveSessions(reads ? (scope === 'device' ? { deviceIds: [deviceId] } : TENANT_WIDE) : null);
  return rows?.find(row => isWatchableSession(row, userId) && row.device?.machineId === deviceId)?.id ?? null;
}
