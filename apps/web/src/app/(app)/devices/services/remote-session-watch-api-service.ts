import { graphql } from 'react-relay';
import type { remoteSessionWatchApiServiceWatchMutation as WatchMutation } from '@/__generated__/remoteSessionWatchApiServiceWatchMutation.graphql';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import { type RawWire, text } from './remote-access-wire';
import { SessionNotFoundError } from './session-recordings-service';

/**
 * Watching a running session view-only, GraphQL on openframe-saas-api:
 * `watchRemoteSession` admits the caller to the session's remote screen for a
 * short while and answers with what the watch socket dials (the request id its
 * relay id starts with, the device node). It is asked again right before every
 * dial and every 10 s while watching. Who is watching changes on the caller's
 * notification subject (see `parseWatchEvent`).
 */

const watchMutation = graphql`
  mutation remoteSessionWatchApiServiceWatchMutation($sessionId: String!) {
    watchRemoteSession(sessionId: $sessionId) {
      requestId
      nodeId
      session {
        status
        viewers {
          userId
          name
          avatarUrl
          leftAt
        }
      }
      userErrors {
        code
        message
      }
    }
  }
`;

/** Someone watching the session right now. */
export interface WatchViewer {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
}

/** What one watch answer admits: the socket's dial and who is watching. */
export interface WatchGrant {
  requestId: string;
  nodeId: string;
  viewers: WatchViewer[];
}

/** The session is over: there is nothing left to watch. */
export class WatchEndedError extends Error {
  constructor() {
    super('The remote session has ended');
    this.name = 'WatchEndedError';
  }
}

/** Watching is switched off for the tenant (the watch flag, live reads, or remote access itself). */
export class WatchDisabledError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message || 'Watching remote sessions is not available');
    this.name = 'WatchDisabledError';
  }
}

const ENDED_CODE = 'REMOTE_SESSION_ENDED';
const NOT_FOUND_CODE = 'REMOTE_SESSION_NOT_FOUND';
const DISABLED_CODES: ReadonlySet<string> = new Set(['REMOTE_ACCESS_DISABLED', 'REMOTE_SESSION_WATCH_DISABLED']);

/** The viewer events, and the end, on the caller's notification subject. */
export const WATCH_EVENT_TYPES = {
  joined: 'REMOTE_SESSION_VIEWER_JOINED',
  left: 'REMOTE_SESSION_VIEWER_LEFT',
  ended: 'REMOTE_SESSION_ENDED',
} as const;

export type WatchEvent = { kind: 'viewers'; viewers: WatchViewer[] } | { kind: 'ended' };

/** The current viewers of a list: one entry per user, those who left dropped. */
function currentViewers(list: readonly unknown[]): WatchViewer[] {
  const seen = new Set<string>();
  const viewers: WatchViewer[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as RawWire;
    const userId = text(raw, 'userId');
    if (!userId || seen.has(userId) || (raw.leftAt !== null && raw.leftAt !== undefined)) continue;
    seen.add(userId);
    viewers.push({ userId, name: text(raw, 'name') ?? null, avatarUrl: text(raw, 'avatarUrl') ?? null });
  }
  return viewers;
}

/**
 * A notification-subject payload -> what it changes for the watched session, or `null` for anything else (another
 * session, another type, a body without the full viewers list).
 */
export function parseWatchEvent(payload: unknown, sessionId: string): WatchEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as RawWire;
  if (text(raw, 'sessionId') !== sessionId) return null;
  if (raw.type === WATCH_EVENT_TYPES.ended) return { kind: 'ended' };
  if (raw.type !== WATCH_EVENT_TYPES.joined && raw.type !== WATCH_EVENT_TYPES.left) return null;
  return Array.isArray(raw.viewers) ? { kind: 'viewers', viewers: currentViewers(raw.viewers) } : null;
}

export class RemoteSessionWatchApiService {
  /**
   * Admit the caller to the session's remote screen, or renew the admission. Throws `WatchEndedError` once the
   * session is over, `WatchDisabledError` while watching is off, `SessionNotFoundError` for an unknown id.
   */
  async watch(sessionId: string): Promise<WatchGrant> {
    const { watchRemoteSession: payload } = await commitMutationPromise<WatchMutation>(watchMutation, { sessionId });
    const [refusal] = payload.userErrors;
    if (refusal) {
      if (refusal.code === ENDED_CODE) throw new WatchEndedError();
      if (refusal.code === NOT_FOUND_CODE) throw new SessionNotFoundError();
      if (DISABLED_CODES.has(refusal.code)) throw new WatchDisabledError(refusal.code, refusal.message);
      throw new Error(refusal.message || 'Could not watch the remote session');
    }
    if (payload.session?.status === 'ENDED') throw new WatchEndedError();
    if (!payload.requestId || !payload.nodeId) throw new Error('Malformed watch answer from the server');
    return {
      requestId: payload.requestId,
      nodeId: payload.nodeId,
      viewers: currentViewers(payload.session?.viewers ?? []),
    };
  }
}

export const remoteSessionWatchApiService = new RemoteSessionWatchApiService();
