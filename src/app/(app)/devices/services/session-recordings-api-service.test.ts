import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { sessionRecordingsApiService_session$data as WireSession } from '@/__generated__/sessionRecordingsApiService_session.graphql';
import { fromWireSession, SessionRecordingsApiService } from './session-recordings-api-service';
import { RecordingUnavailableError } from './session-recordings-service';

const relay = vi.hoisted(() => ({ fetchQuery: vi.fn() }));
const chat = vi.hoisted(() => ({ history: vi.fn() }));
const auth = vi.hoisted(() => ({ bearer: null as string | null }));

vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
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
    dialogId: 'dialog-1',
    technician: { name: 'Roman Smith', avatarUrl: null },
    organization: { organizationId: 'org-1', name: 'Acme', logoUrl: null },
    recordings: [
      {
        recordingId: 'rec-1',
        sizeBytes: 100,
        protocol: 2,
        downloadUrl: '/api/v1/remote-access/recordings/rec-1/download',
      },
      {
        recordingId: 'rec-2',
        sizeBytes: 50,
        protocol: 2,
        downloadUrl: '/api/v1/remote-access/recordings/rec-2/download',
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
      processing: false,
      recordingId: 'rec-1',
      employee: { name: 'Roman Smith' },
    });
  });

  it('has nothing to open while processing or when nothing was recorded', () => {
    expect(fromWireSession(session({ recordingState: 'PROCESSING', recordings: [] }))).toMatchObject({
      processing: true,
      recordingId: null,
      sizeBytes: null,
    });
    expect(fromWireSession(session({ recordingState: 'NONE', recordings: [] }))).toMatchObject({
      processing: false,
      recordingId: null,
    });
  });
});

describe('SessionRecordingsApiService', () => {
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
