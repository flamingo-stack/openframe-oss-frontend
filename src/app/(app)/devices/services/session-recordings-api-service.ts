import { fetchQuery, graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type {
  sessionRecordingsApiService_session$data as WireSession,
  sessionRecordingsApiService_session$key as WireSessionKey,
} from '@/__generated__/sessionRecordingsApiService_session.graphql';
import type { sessionRecordingsApiServiceDetailQuery as DetailQuery } from '@/__generated__/sessionRecordingsApiServiceDetailQuery.graphql';
import type { sessionRecordingsApiServiceDeviceQuery as DeviceQuery } from '@/__generated__/sessionRecordingsApiServiceDeviceQuery.graphql';
import type { sessionRecordingsApiServiceListQuery as ListQuery } from '@/__generated__/sessionRecordingsApiServiceListQuery.graphql';
import { RemoteSessionRecordingState } from '@/generated/schema-enums';
import { clientIdentityHeaders } from '@/lib/client-identity';
import { getRelayEnvironment } from '@/lib/relay';
import { runtimeEnv } from '@/lib/runtime-config';
import { getAccessTokenSync, isBearerAuthMode } from '@/lib/token-store';
import type {
  RecordingChatMessage,
  RecordingDetail,
  RecordingSegment,
  RecordingSummary,
} from '../types/session-recording';
import { remoteSessionChatApiService } from './remote-session-chat-api-service';
import { type ISessionRecordingsService, RecordingUnavailableError } from './session-recordings-service';

/**
 * The Remote Sessions tab and the recording page on openframe-saas-api: one
 * row per remote session (`remoteSessions`), each carrying the `.mcrec` files
 * its tunnel produced; the page opens one file (`remoteSessionRecording`) and
 * reads the session it belongs to.
 */

const sessionFragment = graphql`
  fragment sessionRecordingsApiService_session on RemoteSession @inline {
    sessionId
    deviceId
    startedAt
    durationMs
    recordingState
    dialogId
    technician {
      name
      avatarUrl
    }
    organization {
      organizationId
      name
      logoUrl
    }
    recordings {
      recordingId
      sizeBytes
      protocol
      downloadUrl
    }
  }
`;

const listQuery = graphql`
  query sessionRecordingsApiServiceListQuery($deviceId: String!, $first: Int!, $after: String) {
    remoteSessions(deviceId: $deviceId, first: $first, after: $after) {
      edges {
        node {
          ...sessionRecordingsApiService_session
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const detailQuery = graphql`
  query sessionRecordingsApiServiceDetailQuery($recordingId: String!) {
    remoteSessionRecording(recordingId: $recordingId) {
      recordingId
      session {
        ...sessionRecordingsApiService_session
      }
    }
  }
`;

const deviceQuery = graphql`
  query sessionRecordingsApiServiceDeviceQuery($machineId: String!) {
    device(machineId: $machineId) {
      hostname
    }
  }
`;

/** The server's page ceiling; the tab filters and sorts on the client, so it reads the device's whole history. */
const PAGE_SIZE = 100;
/** A device with more sessions than this shows the newest ones. */
const MAX_PAGES = 10;

/** The wire session (the fragment's data) -> the tab's row. */
export function fromWireSession(session: WireSession): RecordingSummary {
  const files = session.recordings;
  const stored = files.filter(file => file.sizeBytes != null);
  return {
    id: session.sessionId,
    deviceId: session.deviceId,
    startedAt: String(session.startedAt),
    durationMs: session.durationMs != null ? Number(session.durationMs) : null,
    sizeBytes: stored.length > 0 ? stored.reduce((sum, file) => sum + Number(file.sizeBytes), 0) : null,
    protocol: files[0]?.protocol === 1 ? 1 : 2,
    processing: session.recordingState === RemoteSessionRecordingState.PROCESSING,
    recordingId: files[0]?.recordingId ?? null,
    employee: {
      name: session.technician.name,
      avatarUrl: session.technician.avatarUrl ?? undefined,
    },
  };
}

function readSession(ref: WireSessionKey): WireSession {
  return readInlineData(sessionFragment, ref);
}

/** The transcript is extra: a dialog that cannot be read leaves the page without it rather than failing it. */
async function readTranscript(dialogId: string | null | undefined): Promise<RecordingChatMessage[]> {
  if (!dialogId) return [];
  try {
    const { messages } = await remoteSessionChatApiService.history(dialogId);
    return messages.map(message => ({
      id: message.id,
      author: message.authorName,
      fromTechnician: message.author === 'technician',
      sentAt: message.sentAt,
      body: message.body,
    }));
  } catch {
    return [];
  }
}

/** Hostname for the meta card; the session carries only the device id. */
async function readHostname(machineId: string): Promise<string | undefined> {
  try {
    const data = await fetchQuery<DeviceQuery>(
      getRelayEnvironment(),
      deviceQuery,
      { machineId },
      { fetchPolicy: 'store-or-network' },
    ).toPromise();
    return data?.device?.hostname ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The bytes behind a `downloadUrl`. An absolute URL (a signed storage URL) is
 * its own credential and is fetched without cookies. A gateway path is
 * authenticated like any other request and answers with a redirect to such a
 * URL; the credentials mode carries over to that storage request, so cookies go
 * `same-origin` only - `include` would make the bucket's plain "any origin"
 * CORS rule refuse the response.
 */
async function fetchRecordingBytes(downloadUrl: string): Promise<ArrayBuffer> {
  let response: Response;
  if (/^https?:\/\//.test(downloadUrl)) {
    response = await fetch(downloadUrl, { credentials: 'omit' });
  } else {
    const host = runtimeEnv.tenantHostUrl().replace(/\/+$/, '');
    const bearer = isBearerAuthMode() ? getAccessTokenSync() : null;
    response = await fetch(`${host}${downloadUrl}`, {
      credentials: bearer ? 'omit' : 'same-origin',
      headers: { ...clientIdentityHeaders(), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    });
  }
  if (!response.ok) throw new RecordingUnavailableError();
  return response.arrayBuffer();
}

export class SessionRecordingsApiService implements ISessionRecordingsService {
  readonly canDelete = false;

  async list(deviceId: string): Promise<RecordingSummary[]> {
    const rows: RecordingSummary[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data: ListQuery['response'] | undefined = await fetchQuery<ListQuery>(
        getRelayEnvironment(),
        listQuery,
        { deviceId, first: PAGE_SIZE, after },
        { fetchPolicy: 'network-only' },
      ).toPromise();
      const connection: ListQuery['response']['remoteSessions'] | undefined = data?.remoteSessions;
      if (!connection) break;
      for (const edge of connection.edges) rows.push(fromWireSession(readSession(edge.node)));
      if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break;
      after = connection.pageInfo.endCursor;
    }
    return rows;
  }

  async get(recordingId: string): Promise<RecordingDetail> {
    const data = await fetchQuery<DetailQuery>(
      getRelayEnvironment(),
      detailQuery,
      { recordingId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.remoteSessionRecording) throw new Error('Recording not found');
    const session = readSession(data.remoteSessionRecording.session);
    const [hostname, chat] = await Promise.all([readHostname(session.deviceId), readTranscript(session.dialogId)]);
    return {
      ...fromWireSession(session),
      // The file the page was opened on; it plays the whole session regardless.
      recordingId: data.remoteSessionRecording.recordingId,
      hostname,
      organization: {
        id: session.organization?.organizationId ?? undefined,
        name: session.organization?.name ?? '',
        logoUrl: session.organization?.logoUrl ?? undefined,
      },
      segments: session.recordings.map((file): RecordingSegment => ({
        id: file.recordingId,
        downloadUrl: file.downloadUrl ?? undefined,
        sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null,
      })),
      chat,
    };
  }

  async downloadSegment(segment: RecordingSegment): Promise<ArrayBuffer> {
    if (!segment.downloadUrl) throw new RecordingUnavailableError();
    try {
      return await fetchRecordingBytes(segment.downloadUrl);
    } catch (error) {
      // A CORS or network failure is a TypeError; the page treats every miss the same way.
      if (error instanceof RecordingUnavailableError) throw error;
      throw new RecordingUnavailableError();
    }
  }

  async delete(): Promise<void> {
    throw new Error('Recordings cannot be deleted');
  }
}

export const sessionRecordingsApiService = new SessionRecordingsApiService();
