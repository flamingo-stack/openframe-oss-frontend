import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { sessionRecordingsApiService_session$data as WireSession } from '@/__generated__/sessionRecordingsApiService_session.graphql';
import { fromWireSession, SessionRecordingsApiService } from './session-recordings-api-service';
import { RecordingUnavailableError } from './session-recordings-service';

const relay = vi.hoisted(() => ({ fetchQuery: vi.fn(), commitMutation: vi.fn() }));
const chat = vi.hoisted(() => ({ history: vi.fn() }));
const auth = vi.hoisted(() => ({ bearer: null as string | null }));

vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
vi.mock('@/lib/relay/commit-mutation', () => ({ commitMutationPromise: relay.commitMutation }));
// `@inline` fragments are read with `readInlineData`; the wire objects below stand in for the ref.
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
vi.mock('./remote-session-chat-api-service', () => ({ remoteSessionChatApiService: chat }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://tenant.example/' } }));
vi.mock('@/lib/token-store', () => ({
  isBearerAuthMode: () => auth.bearer !== null,
  getAccessTokenSync: () => auth.bearer,
}));

const service = new SessionRecordingsApiService();

function session(overrides: Partial<Record<keyof WireSession, unknown>> = {}): WireSession {
  return {
    sessionId: 'session-1',
    deviceId: 'machine-1',
    startedAt: '2026-09-25T10:49:27Z',
    durationMs: 3_600_000,
    recordingState: 'READY',
    recordingExpiresAt: '2026-12-24T10:49:27Z',
    dialogId: 'dialog-1',
    technician: { name: 'Roman Smith', avatarUrl: null },
    organization: { organizationId: 'org-1', name: 'Acme', logoUrl: null },
    recordings: [
      {
        recordingId: 'rec-1',
        sizeBytes: 100,
        protocol: 2,
        downloadUrl: '/api/v1/remote-access/recordings/rec-1/download',
        status: 'AVAILABLE',
      },
      {
        recordingId: 'rec-2',
        sizeBytes: 50,
        protocol: 2,
        downloadUrl: '/api/v1/remote-access/recordings/rec-2/download',
        status: 'AVAILABLE',
      },
    ],
    ...overrides,
  } as unknown as WireSession;
}

/** Queries answer in order with these payloads. */
function queriesAnswer(...payloads: unknown[]) {
  for (const payload of payloads) {
    relay.fetchQuery.mockReturnValueOnce({ toPromise: () => Promise.resolve(payload) });
  }
}

const fetchMock = vi.fn();

beforeEach(() => {
  relay.fetchQuery.mockReset();
  relay.commitMutation.mockReset();
  chat.history.mockReset();
  fetchMock.mockReset();
  auth.bearer = null;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fromWireSession', () => {
  it('turns a session into a row that opens its first file and totals the file sizes', () => {
    expect(fromWireSession(session())).toMatchObject({
      id: 'session-1',
      deviceId: 'machine-1',
      durationMs: 3_600_000,
      sizeBytes: 150,
      protocol: 2,
      recordingState: 'ready',
      kept: false,
      expiresAt: '2026-12-24T10:49:27Z',
      recordingId: 'rec-1',
      employee: { name: 'Roman Smith' },
    });
  });

  it('has nothing to open while processing or when nothing was recorded', () => {
    expect(
      fromWireSession(session({ recordingState: 'PROCESSING', recordingExpiresAt: null, recordings: [] })),
    ).toMatchObject({ recordingState: 'processing', recordingId: null, sizeBytes: null, expiresAt: null });
    expect(fromWireSession(session({ recordingState: 'NONE', recordings: [] }))).toMatchObject({
      recordingState: 'none',
      recordingId: null,
    });
  });

  it('reads the failed, expired and deleted states, and an unknown one as nothing recorded', () => {
    expect(fromWireSession(session({ recordingState: 'FAILED', recordings: [] })).recordingState).toBe('failed');
    expect(fromWireSession(session({ recordingState: 'EXPIRED' })).recordingState).toBe('expired');
    expect(fromWireSession(session({ recordingState: 'DELETED' })).recordingState).toBe('deleted');
    expect(fromWireSession(session({ recordingState: 'ARCHIVED' })).recordingState).toBe('none');
  });

  it('marks a session kept when any of its files is held', () => {
    const files = session().recordings;
    expect(fromWireSession(session({ recordings: [files[0], { ...files[1], status: 'HELD' }] })).kept).toBe(true);
  });

  it('reads a kept session as a playable one that is kept', () => {
    const files = session().recordings.map(file => ({ ...file, status: 'HELD' }));
    expect(
      fromWireSession(session({ recordingState: 'KEPT', recordingExpiresAt: null, recordings: files })),
    ).toMatchObject({ recordingState: 'ready', kept: true, recordingId: 'rec-1', expiresAt: null, sizeBytes: 150 });
  });

  it('keeps the original size of expired and deleted files', () => {
    const [first, second] = session().recordings;
    expect(fromWireSession(session({ recordings: [{ ...first, status: 'DELETED' }, second] })).sizeBytes).toBe(150);
    expect(
      fromWireSession(
        session({
          recordingState: 'EXPIRED',
          recordings: [
            { ...first, status: 'EXPIRED', downloadUrl: null },
            { ...second, status: 'EXPIRED', downloadUrl: null },
          ],
        }),
      ).sizeBytes,
    ).toBe(150);
  });
});

describe('SessionRecordingsApiService', () => {
  it('deletes by session id and throws the server refusal', async () => {
    relay.commitMutation.mockResolvedValueOnce({ deleteRecording: { userErrors: [] } });
    await service.delete('session-1');
    expect(relay.commitMutation).toHaveBeenCalledWith(expect.anything(), { sessionId: 'session-1' });

    relay.commitMutation.mockResolvedValueOnce({
      deleteRecording: { userErrors: [{ code: 'RECORDING_HELD', message: 'The recording is kept' }] },
    });
    await expect(service.delete('session-1')).rejects.toThrow('The recording is kept');
  });

  it('reads the recording storage, Long fields as numbers', async () => {
    queriesAnswer({
      recordingStorage: {
        usedBytes: '322122547200',
        limitBytes: '322122547200',
        keptBytes: 0,
        keptLimitBytes: '53687091200',
        full: true,
      },
    });
    await expect(service.storage()).resolves.toEqual({
      usedBytes: 322_122_547_200,
      limitBytes: 322_122_547_200,
      keptBytes: 0,
      keptLimitBytes: 53_687_091_200,
      full: true,
    });
  });

  it('reads every page of the device history', async () => {
    queriesAnswer(
      { remoteSessions: { edges: [{ node: session() }], pageInfo: { hasNextPage: true, endCursor: 'c1' } } },
      {
        remoteSessions: {
          edges: [{ node: session({ sessionId: 'session-2' }) }],
          pageInfo: { hasNextPage: false, endCursor: 'c2' },
        },
      },
    );
    const rows = await service.list('machine-1');
    expect(rows.map(row => row.id)).toEqual(['session-1', 'session-2']);
    expect(relay.fetchQuery.mock.calls.map(call => (call[2] as { after: string | null }).after)).toEqual([null, 'c1']);
  });

  it('opens the requested file with its session, every file of it, hostname and transcript', async () => {
    queriesAnswer(
      { remoteSessionRecording: { recordingId: 'rec-2', session: session() } },
      { device: { hostname: 'Romans-MacBook-Pro.local' } },
    );
    chat.history.mockResolvedValue({
      messages: [
        { id: 'm1', author: 'technician', authorName: 'Roman Smith', sentAt: '2026-09-25T10:50:00Z', body: 'Hi' },
        { id: 'm2', author: 'user', authorName: 'User', sentAt: '2026-09-25T10:50:10Z', body: 'Hello' },
      ],
      lastSeq: 0,
    });

    const detail = await service.get('rec-2');
    expect(detail).toMatchObject({
      id: 'session-1',
      recordingId: 'rec-2',
      hostname: 'Romans-MacBook-Pro.local',
      organization: { id: 'org-1', name: 'Acme' },
      segments: [
        { id: 'rec-1', downloadUrl: '/api/v1/remote-access/recordings/rec-1/download', sizeBytes: 100 },
        { id: 'rec-2', downloadUrl: '/api/v1/remote-access/recordings/rec-2/download', sizeBytes: 50 },
      ],
    });
    expect(detail.chat.map(message => [message.author, message.fromTechnician])).toEqual([
      ['Roman Smith', true],
      ['User', false],
    ]);
    expect(chat.history).toHaveBeenCalledWith('dialog-1');
  });

  it('still opens the page when the transcript cannot be read', async () => {
    queriesAnswer({ remoteSessionRecording: { recordingId: 'rec-1', session: session() } }, { device: null });
    chat.history.mockRejectedValue(new Error('chat down'));
    const detail = await service.get('rec-1');
    expect(detail.chat).toEqual([]);
    expect(detail.hostname).toBeUndefined();
  });

  it('fetches a signed storage URL without cookies', async () => {
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
    const bytes = await service.downloadSegment({
      downloadUrl: 'https://storage.example/rec-1?sig=1',
    } as Parameters<typeof service.downloadSegment>[0]);
    expect(bytes.byteLength).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith('https://storage.example/rec-1?sig=1', { credentials: 'omit' });
  });

  it('sends cookies to the gateway only, so the redirect to storage goes without them', async () => {
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) });
    await service.downloadSegment({
      downloadUrl: '/api/v1/remote-access/recordings/rec-1/download',
    } as Parameters<typeof service.downloadSegment>[0]);
    expect(fetchMock).toHaveBeenCalledWith('https://tenant.example/api/v1/remote-access/recordings/rec-1/download', {
      credentials: 'same-origin',
      headers: {},
    });
  });

  it('fetches a gateway path on the tenant host with the bearer token', async () => {
    auth.bearer = 'token-1';
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) });
    await service.downloadSegment({
      downloadUrl: '/api/v1/remote-access/recordings/rec-1/download',
    } as Parameters<typeof service.downloadSegment>[0]);
    expect(fetchMock).toHaveBeenCalledWith('https://tenant.example/api/v1/remote-access/recordings/rec-1/download', {
      credentials: 'omit',
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('reports every failed or missing download as unavailable', async () => {
    const recording = { downloadUrl: 'https://storage.example/rec-1' } as Parameters<typeof service.downloadSegment>[0];
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(service.downloadSegment(recording)).rejects.toBeInstanceOf(RecordingUnavailableError);
    // A CORS refusal surfaces as a TypeError from fetch.
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(service.downloadSegment(recording)).rejects.toBeInstanceOf(RecordingUnavailableError);
    await expect(
      service.downloadSegment({ downloadUrl: undefined } as Parameters<typeof service.downloadSegment>[0]),
    ).rejects.toBeInstanceOf(RecordingUnavailableError);
  });
});
