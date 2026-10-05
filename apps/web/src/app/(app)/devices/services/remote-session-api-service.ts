import { fetchQuery, graphql } from 'react-relay';
import { getRequest, readInlineData } from 'relay-runtime';
import type {
  remoteSessionApiService_session$data as WireSession,
  remoteSessionApiService_session$key as WireSessionKey,
} from '@/__generated__/remoteSessionApiService_session.graphql';
import type { remoteSessionApiServiceActiveQuery as ActiveQuery } from '@/__generated__/remoteSessionApiServiceActiveQuery.graphql';
import type { remoteSessionApiServiceEndMutation as EndMutation } from '@/__generated__/remoteSessionApiServiceEndMutation.graphql';
import type { remoteSessionApiServiceSessionQuery as SessionQuery } from '@/__generated__/remoteSessionApiServiceSessionQuery.graphql';
import { getRelayEnvironment } from '@/lib/relay';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import { sendGraphqlKeepalive } from '@/lib/relay/environment';
import {
  REMOTE_ACCESS_MODES,
  type RemoteAccessMode,
  type RemoteSession,
  type RemoteSessionEndReason,
  type RemoteSessionEvent,
  type RemoteSessionStatus,
} from '../types/remote-access';
import { nullableTimestamp, oneOf, type RawWire, text, timestamp } from './remote-access-wire';

/**
 * The technician side of the remote session lifecycle, GraphQL on
 * openframe-saas-api like the approval client: `activeRemoteSession(deviceId)`
 * finds the record an approval opened (the caller's own only), `remoteSession`
 * is the poll fallback, `endRemoteSession` is the technician's own end. The
 * lifecycle push is not part of this service: REMOTE_SESSION_STARTED / ENDED
 * arrive on the technician's notification subject, which `useRemoteSession`
 * subscribes to (see `parseRemoteSessionEvent`).
 */

/** Every operation reads the whole session; `@inline` because the reader is a service, not a component. */
const sessionFragment = graphql`
  fragment remoteSessionApiService_session on RemoteSession @inline {
    sessionId
    requestId
    deviceId
    technicianId
    mode
    status
    startedAt
    endedAt
    endReason
    reason
    ticketId
    ticketNumber
    recordingEnabled
    dialogId
  }
`;

const activeQuery = graphql`
  query remoteSessionApiServiceActiveQuery($deviceId: String!) {
    activeRemoteSession(deviceId: $deviceId) {
      ...remoteSessionApiService_session
    }
  }
`;

const sessionQuery = graphql`
  query remoteSessionApiServiceSessionQuery($sessionId: String!) {
    remoteSession(sessionId: $sessionId) {
      ...remoteSessionApiService_session
    }
  }
`;

const endMutation = graphql`
  mutation remoteSessionApiServiceEndMutation($sessionId: String!) {
    endRemoteSession(sessionId: $sessionId) {
      session {
        ...remoteSessionApiService_session
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const STATUSES: ReadonlySet<string> = new Set(['ACTIVE', 'ENDED']);
const MODES: ReadonlySet<string> = new Set(REMOTE_ACCESS_MODES);
const END_REASONS: ReadonlySet<string> = new Set(['admin', 'client', 'timeout', 'connection_lost', 'policy']);
/** An end of an already ended session: the outcome is the same, nothing left to end. */
const END_ALREADY_ENDED_CODE = 'REMOTE_SESSION_ENDED';

/** The GraphQL enum is upper-case, the NATS event lower-case; the app keeps the lower-case form. */
function endReason(value: unknown): RemoteSessionEndReason | null {
  return typeof value === 'string' ? (oneOf<RemoteSessionEndReason>(value.toLowerCase(), END_REASONS) ?? null) : null;
}

/** The wire session (the fragment's data) -> the app's read model. Throws on a body without the required fields. */
export function fromWireRemoteSession(data: WireSession): RemoteSession {
  const status = oneOf<RemoteSessionStatus>(data.status, STATUSES);
  if (!data.sessionId || !status) {
    throw new Error('Malformed remote session from the server');
  }
  return {
    sessionId: data.sessionId,
    requestId: data.requestId,
    deviceId: data.deviceId,
    technicianId: data.technicianId,
    sessionKind: 'desktop',
    mode: oneOf<RemoteAccessMode>(data.mode, MODES),
    status,
    startedAt: timestamp(data.startedAt) ?? new Date().toISOString(),
    endedAt: nullableTimestamp(data.endedAt),
    endReason: endReason(data.endReason),
    reason: data.reason ?? undefined,
    ticketId: data.ticketId ?? undefined,
    ticketNumber: data.ticketNumber ?? undefined,
    recordingEnabled: data.recordingEnabled === true,
    dialogId: data.dialogId ?? null,
  };
}

function readSession(ref: WireSessionKey): RemoteSession {
  return fromWireRemoteSession(readInlineData(sessionFragment, ref));
}

/** A notification-subject payload -> the lifecycle event, or `null` for anything else. */
export function parseRemoteSessionEvent(payload: unknown): RemoteSessionEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as RawWire;
  const type = raw.type;
  if (type !== 'REMOTE_SESSION_STARTED' && type !== 'REMOTE_SESSION_ENDED') return null;
  const sessionId = text(raw, 'sessionId');
  if (!sessionId) return null;
  return {
    type,
    sessionId,
    requestId: text(raw, 'requestId'),
    startedAt: timestamp(raw.startedAt),
    dialogId: text(raw, 'dialogId') ?? null,
    recordingEnabled: raw.recordingEnabled === true,
    endReason: endReason(raw.endReason),
    endedAt: nullableTimestamp(raw.endedAt),
  };
}

/**
 * Fold a lifecycle event into the session it belongs to. STARTED builds the
 * record when none is known yet (the query may still be on its way); ENDED
 * settles whatever is known - or the event alone, so a Back after a missed
 * STARTED has nothing left to end.
 */
export function applyRemoteSessionEvent(session: RemoteSession | null, event: RemoteSessionEvent): RemoteSession {
  const base: RemoteSession = session ?? {
    sessionId: event.sessionId,
    requestId: event.requestId ?? '',
    sessionKind: 'desktop',
    status: 'ACTIVE',
    startedAt: event.startedAt ?? new Date().toISOString(),
    recordingEnabled: event.recordingEnabled,
    dialogId: event.dialogId,
  };
  if (event.type === 'REMOTE_SESSION_STARTED') {
    return session ? { ...session, dialogId: session.dialogId ?? event.dialogId } : base;
  }
  return { ...base, status: 'ENDED', endReason: event.endReason, endedAt: event.endedAt ?? null };
}

export class RemoteSessionApiService {
  /** The caller's own ACTIVE session on the device, or null (another technician's reads as null too). */
  async active(deviceId: string): Promise<RemoteSession | null> {
    const data = await fetchQuery<ActiveQuery>(
      getRelayEnvironment(),
      activeQuery,
      { deviceId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    return data?.activeRemoteSession ? readSession(data.activeRemoteSession) : null;
  }

  async get(sessionId: string): Promise<RemoteSession> {
    const data = await fetchQuery<SessionQuery>(
      getRelayEnvironment(),
      sessionQuery,
      { sessionId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.remoteSession) throw new Error('Remote session not found');
    return readSession(data.remoteSession);
  }

  /** The technician ends their own session; a session that is already over counts as ended. */
  async end(sessionId: string): Promise<void> {
    const payload = await commitMutationPromise<EndMutation>(endMutation, { sessionId });
    const blocking = payload.endRemoteSession.userErrors.filter(e => e.code !== END_ALREADY_ENDED_CODE);
    if (blocking.length > 0) throw new Error(blocking[0].message || 'Could not end the remote session');
  }

  /** The same end, sent as the document goes away; nothing can read the answer. */
  endOnUnload(sessionId: string): void {
    sendGraphqlKeepalive(getRequest(endMutation).params, { sessionId });
  }
}

export const remoteSessionApiService = new RemoteSessionApiService();
