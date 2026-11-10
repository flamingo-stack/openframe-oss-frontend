import type { RemoteSessionViewer } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { WatchViewer } from '../../services/remote-session-watch-api-service';
import type { RecordingSummary } from '../../types/session-recording';

/** A watcher whose profile had no name when they joined. */
const UNNAMED_VIEWER = 'Technician';

/**
 * Everyone in a live session for the viewers stack: the host first, then those watching. The host watching their own
 * session from another tab is listed once, as the host; the signed-in technician is marked as "you".
 */
export function sessionViewers(
  session: Pick<RecordingSummary, 'technicianId' | 'employee'>,
  viewers: readonly WatchViewer[],
  userId: string | null,
): RemoteSessionViewer[] {
  const host: RemoteSessionViewer = {
    id: session.technicianId,
    name: session.employee.name,
    avatarUrl: session.employee.avatarUrl ?? null,
    isHost: true,
    isYou: userId !== null && session.technicianId === userId,
  };
  const watching = viewers
    .filter(viewer => viewer.userId !== session.technicianId)
    .map(viewer => ({
      id: viewer.userId,
      name: viewer.name ?? UNNAMED_VIEWER,
      avatarUrl: viewer.avatarUrl,
      isYou: userId !== null && viewer.userId === userId,
    }));
  return [host, ...watching];
}
