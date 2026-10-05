import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { remoteSessionApiService_session$data as WireSession } from '@/__generated__/remoteSessionApiService_session.graphql';
import {
  applyRemoteSessionEvent,
  fromWireRemoteSession,
  parseRemoteSessionEvent,
  RemoteSessionApiService,
} from './remote-session-api-service';

type MutationConfig = {
  variables: Record<string, unknown>;
  onCompleted: (response: unknown, errors: ReadonlyArray<{ message: string }> | null) => void;
  onError: (error: Error) => void;
};

const relay = vi.hoisted(() => ({
  commitMutation: vi.fn(),
  fetchQuery: vi.fn(),
  sendGraphqlKeepalive: vi.fn(),
}));

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  commitMutation: relay.commitMutation,
  fetchQuery: relay.fetchQuery,
}));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
vi.mock('@/lib/relay/environment', () => ({ sendGraphqlKeepalive: relay.sendGraphqlKeepalive }));
// `@inline` fragments are read with `readInlineData`; the wire objects below stand in for the ref.
vi.mock('relay-runtime', () => ({
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
  getRequest: () => ({ params: { text: 'mutation endRemoteSession' } }),
}));

const SESSION_ID = '01SESSION0000000000000000A';
const REQUEST_ID = '01REQUEST0000000000000000A';

const WIRE_SESSION = {
  sessionId: SESSION_ID,
  requestId: REQUEST_ID,
  deviceId: 'machine-1',
  technicianId: 'tech-1',
  mode: 'APPROVAL_REQUIRED',
  status: 'ACTIVE',
  startedAt: '2026-09-23T10:00:00Z',
  endedAt: null,
  endReason: null,
  reason: null,
  ticketId: null,
  ticketNumber: null,
  recordingEnabled: true,
  dialogId: null,
};

const wireSession = (overrides: Record<string, unknown> = {}): WireSession =>
  ({ ...WIRE_SESSION, ...overrides }) as unknown as WireSession;

/** The next mutation completes with `response` (or a GraphQL-level error). */
function completeMutationWith(response: unknown, errors: ReadonlyArray<{ message: string }> | null = null) {
  relay.commitMutation.mockImplementationOnce((_env: unknown, config: MutationConfig) => {
    config.onCompleted(response, errors);
    return { dispose: () => {} };
  });
}

function lastMutationVariables(): Record<string, unknown> {
  const call = relay.commitMutation.mock.calls.at(-1);
  return (call?.[1] as MutationConfig).variables;
}

const service = new RemoteSessionApiService();

/** A parse the test expects to succeed. */
function must<T>(value: T | null): T {
  if (value === null) throw new Error('expected a parsed event');
  return value;
}

describe('RemoteSessionApiService', () => {
  beforeEach(() => {
    relay.commitMutation.mockReset();
    relay.fetchQuery.mockReset();
    relay.sendGraphqlKeepalive.mockReset();
  });

  it('finds the active session of a device over the network, or none', async () => {
    relay.fetchQuery.mockReturnValueOnce({
      toPromise: () => Promise.resolve({ activeRemoteSession: WIRE_SESSION }),
    });
    const session = await service.active('machine-1');
    expect(relay.fetchQuery.mock.calls[0][2]).toEqual({ deviceId: 'machine-1' });
    expect(relay.fetchQuery.mock.calls[0][3]).toEqual({ fetchPolicy: 'network-only' });
    expect(session).toMatchObject({ sessionId: SESSION_ID, requestId: REQUEST_ID, status: 'ACTIVE', dialogId: null });

    relay.fetchQuery.mockReturnValueOnce({ toPromise: () => Promise.resolve({ activeRemoteSession: null }) });
    expect(await service.active('machine-1')).toBeNull();
  });

  it('reads one session by id and rejects when it is gone', async () => {
    relay.fetchQuery.mockReturnValueOnce({
      toPromise: () => Promise.resolve({ remoteSession: { ...WIRE_SESSION, status: 'ENDED', endReason: 'CLIENT' } }),
    });
    const session = await service.get(SESSION_ID);
    expect(relay.fetchQuery.mock.calls[0][2]).toEqual({ sessionId: SESSION_ID });
    expect(session).toMatchObject({ status: 'ENDED', endReason: 'client' });

    relay.fetchQuery.mockReturnValueOnce({ toPromise: () => Promise.reject(new Error('not found')) });
    await expect(service.get('missing')).rejects.toThrow('not found');
  });

  it('ends a session, takes an already ended one as done and surfaces other refusals', async () => {
    completeMutationWith({
      endRemoteSession: { session: { ...WIRE_SESSION, status: 'ENDED', endReason: 'ADMIN' }, userErrors: [] },
    });
    await expect(service.end(SESSION_ID)).resolves.toBeUndefined();
    expect(lastMutationVariables()).toEqual({ sessionId: SESSION_ID });

    completeMutationWith({
      endRemoteSession: { session: null, userErrors: [{ code: 'REMOTE_SESSION_ENDED', message: 'already over' }] },
    });
    await expect(service.end(SESSION_ID)).resolves.toBeUndefined();

    completeMutationWith({
      endRemoteSession: { session: null, userErrors: [{ code: 'REMOTE_ACCESS_FORBIDDEN', message: 'not yours' }] },
    });
    await expect(service.end(SESSION_ID)).rejects.toThrow('not yours');

    completeMutationWith(null, [{ message: 'Unauthorized' }]);
    await expect(service.end(SESSION_ID)).rejects.toThrow('Unauthorized');
  });

  it('sends the end as a keepalive request on unload', () => {
    service.endOnUnload(SESSION_ID);
    expect(relay.sendGraphqlKeepalive).toHaveBeenCalledWith(
      { text: 'mutation endRemoteSession' },
      { sessionId: SESSION_ID },
    );
  });
});

describe('fromWireRemoteSession', () => {
  it('folds the upper-case end reason and tolerates numeric epochs', () => {
    const session = fromWireRemoteSession(
      wireSession({ status: 'ENDED', endReason: 'CONNECTION_LOST', startedAt: 1790157600, endedAt: 1790157660000 }),
    );
    expect(session.endReason).toBe('connection_lost');
    expect(session.startedAt).toBe('2026-09-23T10:00:00.000Z');
    expect(session.endedAt).toBe('2026-09-23T10:01:00.000Z');
    expect(session.sessionKind).toBe('desktop');
    expect(session.recordingEnabled).toBe(true);
  });

  it('keeps the dialog id and drops an unknown end reason', () => {
    const session = fromWireRemoteSession(wireSession({ dialogId: 'dlg-1', endReason: 'WHATEVER' }));
    expect(session.dialogId).toBe('dlg-1');
    expect(session.endReason).toBeNull();
  });

  it('rejects a body without id or status', () => {
    expect(() => fromWireRemoteSession(wireSession({ sessionId: '' }))).toThrow();
    expect(() => fromWireRemoteSession(wireSession({ status: 'PARKED' }))).toThrow();
  });
});

describe('remote session events', () => {
  it('parses only the two lifecycle types with a session id', () => {
    expect(parseRemoteSessionEvent({ type: 'REMOTE_ACCESS_DECISION', sessionId: SESSION_ID })).toBeNull();
    expect(parseRemoteSessionEvent({ type: 'REMOTE_SESSION_STARTED' })).toBeNull();
    expect(parseRemoteSessionEvent('nope')).toBeNull();
    const started = parseRemoteSessionEvent({
      type: 'REMOTE_SESSION_STARTED',
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      startedAt: '2026-09-23T10:00:00Z',
      recordingEnabled: true,
      dialogId: 'dlg-1',
    });
    expect(started).toEqual({
      type: 'REMOTE_SESSION_STARTED',
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      startedAt: '2026-09-23T10:00:00Z',
      dialogId: 'dlg-1',
      recordingEnabled: true,
      endReason: null,
      endedAt: undefined,
    });
    const ended = parseRemoteSessionEvent({
      type: 'REMOTE_SESSION_ENDED',
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      endReason: 'client',
      endedAt: '2026-09-23T10:05:00Z',
    });
    expect(ended).toMatchObject({ type: 'REMOTE_SESSION_ENDED', endReason: 'client', endedAt: '2026-09-23T10:05:00Z' });
    expect(
      parseRemoteSessionEvent({ type: 'REMOTE_SESSION_ENDED', sessionId: SESSION_ID, endReason: 'TIMEOUT' })?.endReason,
    ).toBe('timeout');
  });

  it('builds the session from STARTED when none is known and settles it on ENDED', () => {
    const started = must(
      parseRemoteSessionEvent({
        type: 'REMOTE_SESSION_STARTED',
        sessionId: SESSION_ID,
        requestId: REQUEST_ID,
        dialogId: 'dlg-1',
      }),
    );
    const session = applyRemoteSessionEvent(null, started);
    expect(session).toMatchObject({
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      status: 'ACTIVE',
      dialogId: 'dlg-1',
    });

    const known = fromWireRemoteSession(wireSession({ dialogId: 'dlg-2' }));
    expect(applyRemoteSessionEvent(known, started).dialogId).toBe('dlg-2');

    const ended = must(
      parseRemoteSessionEvent({
        type: 'REMOTE_SESSION_ENDED',
        sessionId: SESSION_ID,
        endReason: 'client',
        endedAt: '2026-09-23T10:05:00Z',
      }),
    );
    expect(applyRemoteSessionEvent(known, ended)).toMatchObject({
      status: 'ENDED',
      endReason: 'client',
      endedAt: '2026-09-23T10:05:00Z',
      dialogId: 'dlg-2',
    });
    expect(applyRemoteSessionEvent(null, ended)).toMatchObject({ sessionId: SESSION_ID, status: 'ENDED' });
  });
});
