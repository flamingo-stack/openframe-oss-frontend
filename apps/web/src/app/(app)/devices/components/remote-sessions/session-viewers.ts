import type { RemoteSessionViewer } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { RemoteSessionViewerEntry } from '../../types/remote-access';

/** A watcher whose profile had no name when they joined. */
const UNNAMED_VIEWER = 'Technician';

/** The technician whose session it is, as the viewers stack shows them. */
export interface SessionHost {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Everyone in a live session for the viewers stack: the host first, then those watching. The host watching their own
 * session from another tab is listed once, as the host; the signed-in technician is marked as "you".
 */
export function sessionViewers(
  host: SessionHost,
  viewers: readonly RemoteSessionViewerEntry[],
  userId: string | null,
): RemoteSessionViewer[] {
  const hostEntry: RemoteSessionViewer = {
    id: host.id,
    name: host.name,
    avatarUrl: host.avatarUrl,
    isHost: true,
    isYou: userId !== null && host.id === userId,
  };
  const watching = viewers
    .filter(viewer => viewer.userId !== host.id)
    .map(viewer => ({
      id: viewer.userId,
      name: viewer.name ?? UNNAMED_VIEWER,
      avatarUrl: viewer.avatarUrl,
      isYou: userId !== null && viewer.userId === userId,
    }));
  return [hostEntry, ...watching];
}
