import type {
  KeepRecordingSelection,
  RemoteSessionKeepReason,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { fetchQuery, graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type {
  sessionRecordingsApiService_session$data as WireSession,
  sessionRecordingsApiService_session$key as WireSessionKey,
} from '@/__generated__/sessionRecordingsApiService_session.graphql';
import type { sessionRecordingsApiServiceDeleteMutation as DeleteMutation } from '@/__generated__/sessionRecordingsApiServiceDeleteMutation.graphql';
import type { sessionRecordingsApiServiceDetailQuery as DetailQuery } from '@/__generated__/sessionRecordingsApiServiceDetailQuery.graphql';
import type { sessionRecordingsApiServiceDeviceQuery as DeviceQuery } from '@/__generated__/sessionRecordingsApiServiceDeviceQuery.graphql';
import type { sessionRecordingsApiServiceKeepMutation as KeepMutation } from '@/__generated__/sessionRecordingsApiServiceKeepMutation.graphql';
import type { sessionRecordingsApiServiceListQuery as ListQuery } from '@/__generated__/sessionRecordingsApiServiceListQuery.graphql';
import type { sessionRecordingsApiServiceReleaseMutation as ReleaseMutation } from '@/__generated__/sessionRecordingsApiServiceReleaseMutation.graphql';
import type { sessionRecordingsApiServiceStorageQuery as StorageQuery } from '@/__generated__/sessionRecordingsApiServiceStorageQuery.graphql';
import {
  RecordingHoldReason,
  RemoteSessionRecordingState,
  RemoteSessionRecordingStatus,
} from '@/generated/schema-enums';
import { getRelayEnvironment } from '@/lib/relay';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import { runtimeEnv } from '@/lib/runtime-config';
import { getAccessTokenSync, isBearerAuthMode } from '@/lib/token-store';
import type {
  RecordingChatMessage,
  RecordingDetail,
  RecordingKeep,
  RecordingSegment,
  RecordingState,
  RecordingStorage,
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
    recordingExpiresAt
    recordingHold {
      heldBy {
        name
      }
      heldAt
      reason
      note
      dueAt
      expiresAtOnRelease
    }
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
      status
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

const storageQuery = graphql`
  query sessionRecordingsApiServiceStorageQuery {
    recordingStorage {
      usedBytes
      limitBytes
      keptBytes
      keptLimitBytes
      full
    }
  }
`;

const deleteMutation = graphql`
  mutation sessionRecordingsApiServiceDeleteMutation($sessionId: String!) {
    deleteRecording(sessionId: $sessionId) {
      userErrors {
        code
        message
      }
    }
  }
`;

const keepMutation = graphql`
  mutation sessionRecordingsApiServiceKeepMutation($input: KeepRecordingInput!) {
    keepRecording(input: $input) {
      userErrors {
        code
        message
      }
    }
  }
`;

const releaseMutation = graphql`
  mutation sessionRecordingsApiServiceReleaseMutation($sessionId: String!) {
    releaseRecording(sessionId: $sessionId) {
      userErrors {
        code
        message
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

const RECORDING_STATES: Record<RemoteSessionRecordingState, RecordingState> = {
  [RemoteSessionRecordingState.NONE]: 'none',
  [RemoteSessionRecordingState.PROCESSING]: 'processing',
  [RemoteSessionRecordingState.READY]: 'ready',
  // A kept session plays like a ready one; `kept` carries the Keep.
  [RemoteSessionRecordingState.KEPT]: 'ready',
  [RemoteSessionRecordingState.FAILED]: 'failed',
  [RemoteSessionRecordingState.EXPIRED]: 'expired',
  [RemoteSessionRecordingState.DELETED]: 'deleted',
};

// The core-lib Keep modal names one reason differently from the server.
const KEEP_REASONS_FROM_WIRE: Record<RecordingHoldReason, RemoteSessionKeepReason> = {
  [RecordingHoldReason.CLIENT_DISPUTE]: 'CLIENT_DISPUTE',
  [RecordingHoldReason.INTERNAL_REVIEW]: 'INTERNAL_REVIEW',
  [RecordingHoldReason.LEGAL_COMPLIANCE]: 'LEGAL_OR_COMPLIANCE',
  [RecordingHoldReason.OTHER]: 'OTHER',
};

const KEEP_REASONS_TO_WIRE: Record<RemoteSessionKeepReason, RecordingHoldReason> = {
  CLIENT_DISPUTE: RecordingHoldReason.CLIENT_DISPUTE,
  INTERNAL_REVIEW: RecordingHoldReason.INTERNAL_REVIEW,
  LEGAL_OR_COMPLIANCE: RecordingHoldReason.LEGAL_COMPLIANCE,
  OTHER: RecordingHoldReason.OTHER,
};

function fromWireHold(hold: NonNullable<WireSession['recordingHold']>): RecordingKeep {
  return {
    keptBy: hold.heldBy.name,
    keptAt: String(hold.heldAt),
    // A reason this client does not know yet still reads as a Keep.
    reason: KEEP_REASONS_FROM_WIRE[hold.reason as RecordingHoldReason] ?? 'OTHER',
    note: hold.note ?? null,
    dueAt: hold.dueAt != null ? String(hold.dueAt) : null,
    expiresAtOnRelease: hold.expiresAtOnRelease != null ? String(hold.expiresAtOnRelease) : null,
  };
}

/** The wire session (the fragment's data) -> the tab's row. */
export function fromWireSession(session: WireSession): RecordingSummary {
  const files = session.recordings;
  // An expired or deleted file keeps its original size, and the row shows it as the design does.
  const stored = files.filter(file => file.sizeBytes != null);
  return {
    id: session.sessionId,
    deviceId: session.deviceId,
    startedAt: String(session.startedAt),
    durationMs: session.durationMs != null ? Number(session.durationMs) : null,
    sizeBytes: stored.length > 0 ? stored.reduce((sum, file) => sum + Number(file.sizeBytes), 0) : null,
    protocol: files[0]?.protocol === 1 ? 1 : 2,
    // A state this client does not know yet reads as "nothing to show", not as playable.
    recordingState: RECORDING_STATES[session.recordingState as RemoteSessionRecordingState] ?? 'none',
    kept:
      session.recordingState === RemoteSessionRecordingState.KEPT ||
      files.some(file => file.status === RemoteSessionRecordingStatus.HELD),
    keep: session.recordingHold ? fromWireHold(session.recordingHold) : null,
    expiresAt: session.recordingExpiresAt != null ? String(session.recordingExpiresAt) : null,
    recordingId: files[0]?.recordingId ?? null,
    employee: {
      name: session.technician.name,
      avatarUrl: session.technician.avatarUrl ?? undefined,
    },
  };
}

/** A session row's selection, read from wherever it was spread - the device list, the detail, the tenant-wide list. */
export function readSession(ref: WireSessionKey): WireSession {
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
 * CORS rule refuse the response. No `X-OpenFrame-Client` here: the browser
 * carries it across the redirect, and a custom header turns the storage GET
 * into a preflighted request the bucket does not answer.
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
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    });
  }
  if (!response.ok) throw new RecordingUnavailableError();
  return response.arrayBuffer();
}

export class SessionRecordingsApiService implements ISessionRecordingsService {
  readonly canDelete = true;

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

  async delete(sessionId: string): Promise<void> {
    const payload = await commitMutationPromise<DeleteMutation>(deleteMutation, { sessionId });
    const [refusal] = payload.deleteRecording.userErrors;
    if (refusal) throw new Error(refusal.message || 'Could not delete the recording');
  }

  async keep(sessionId: string, { reason, description }: KeepRecordingSelection): Promise<void> {
    const payload = await commitMutationPromise<KeepMutation>(keepMutation, {
      input: { sessionId, reason: KEEP_REASONS_TO_WIRE[reason], note: description },
    });
    const [refusal] = payload.keepRecording.userErrors;
    if (refusal) throw new Error(refusal.message || 'Could not keep the recording');
  }

  async release(sessionId: string): Promise<void> {
    const payload = await commitMutationPromise<ReleaseMutation>(releaseMutation, { sessionId });
    const [refusal] = payload.releaseRecording.userErrors;
    if (refusal) throw new Error(refusal.message || 'Could not release the recording');
  }

  async storage(): Promise<RecordingStorage> {
    const data = await fetchQuery<StorageQuery>(
      getRelayEnvironment(),
      storageQuery,
      {},
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.recordingStorage) throw new Error('Recording storage unavailable');
    const { usedBytes, limitBytes, keptBytes, keptLimitBytes, full } = data.recordingStorage;
    return {
      usedBytes: Number(usedBytes),
      limitBytes: Number(limitBytes),
      keptBytes: Number(keptBytes),
      keptLimitBytes: Number(keptLimitBytes),
      full,
    };
  }
}

export const sessionRecordingsApiService: ISessionRecordingsService = new SessionRecordingsApiService();
