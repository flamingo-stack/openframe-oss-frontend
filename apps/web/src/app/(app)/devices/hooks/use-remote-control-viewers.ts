'use client';

import type { RemoteSessionViewer } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useRemoteAccessSession } from '../components/remote-access/remote-access-session-context';
import { sessionViewers } from '../components/remote-sessions/session-viewers';
import { useRemoteSessionChatTechnician } from './use-remote-session-chat';
import { useRemoteSessionWatchGate } from './use-remote-session-watch-gate';

/**
 * Who the Remote Control header shows (Watch live): the technician running the session, then everyone watching it.
 * Empty while nobody but the host is there - the host's own face alone says nothing, and the host watching from a
 * second tab is the host - and with Watch live off or the session over. The list follows the session record, which
 * the viewer events and the poll keep current (`useRemoteSession`).
 */
export function useRemoteControlViewers(): RemoteSessionViewer[] {
  const gate = useRemoteSessionWatchGate();
  const { session, ended } = useRemoteAccessSession();
  const technician = useRemoteSessionChatTechnician();
  const userId = useAuthStore(s => s.user?.id ?? null);

  if (gate !== 'on' || !session || ended || session.status === 'ENDED' || !userId) return [];
  // The page runs the signed-in technician's own session.
  const hostId = session.technicianId ?? userId;
  if (!session.viewers.some(viewer => viewer.userId !== hostId)) return [];
  return sessionViewers(
    { id: hostId, name: technician.name, avatarUrl: technician.avatarUrl ?? null },
    session.viewers,
    userId,
  );
}
