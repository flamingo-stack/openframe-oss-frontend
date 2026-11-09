/**
 * Watching a running session: the watch answer is the socket's dial and who is watching now (those who left dropped,
 * one entry per user), and each refusal comes back as its own error so the page knows to stop. The viewer events and
 * the end are read from the notification subject for the watched session only, by their exact type names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseWatchEvent,
  RemoteSessionWatchApiService,
  WATCH_EVENT_TYPES,
  WatchDisabledError,
  WatchEndedError,
} from './remote-session-watch-api-service';
import { SessionNotFoundError } from './session-recordings-service';

type MutationConfig = {
  variables: Record<string, unknown>;
  onCompleted: (response: unknown, errors: ReadonlyArray<{ message: string }> | null) => void;
};

const relay = vi.hoisted(() => ({ commitMutation: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}), commitMutation: relay.commitMutation }));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));

const SESSION_ID = '01SESSION0000000000000000A';

function answer(payload: Record<string, unknown>) {
  relay.commitMutation.mockImplementationOnce((_env: unknown, config: MutationConfig) =>
    config.onCompleted({ watchRemoteSession: { userErrors: [], ...payload } }, null),
  );
}

const viewer = (userId: string, leftAt: string | null = null) => ({
  userId,
  name: `Name ${userId}`,
  avatarUrl: null,
  leftAt,
});

describe('RemoteSessionWatchApiService.watch', () => {
  const service = new RemoteSessionWatchApiService();

  beforeEach(() => relay.commitMutation.mockReset());

  it('answers the dial and the current viewers, one per user, without those who left', async () => {
    answer({
      requestId: 'REQ-1',
      nodeId: 'node/1',
      session: { status: 'ACTIVE', viewers: [viewer('a'), viewer('b', '2026-11-09T10:00:00Z'), viewer('a')] },
    });
    await expect(service.watch(SESSION_ID)).resolves.toEqual({
      requestId: 'REQ-1',
      nodeId: 'node/1',
      viewers: [{ userId: 'a', name: 'Name a', avatarUrl: null }],
    });
    expect(relay.commitMutation.mock.calls[0][1].variables).toEqual({ sessionId: SESSION_ID });
  });

  it('turns each refusal into the error the page stops on', async () => {
    const refuse = (code: string) => answer({ userErrors: [{ code, message: `${code} message` }] });

    refuse('REMOTE_SESSION_ENDED');
    await expect(service.watch(SESSION_ID)).rejects.toBeInstanceOf(WatchEndedError);
    refuse('REMOTE_SESSION_NOT_FOUND');
    await expect(service.watch(SESSION_ID)).rejects.toBeInstanceOf(SessionNotFoundError);
    for (const code of ['REMOTE_SESSION_WATCH_DISABLED', 'REMOTE_ACCESS_DISABLED']) {
      refuse(code);
      await expect(service.watch(SESSION_ID)).rejects.toMatchObject({ name: 'WatchDisabledError', code });
    }
    refuse('SOMETHING_NEW');
    await expect(service.watch(SESSION_ID)).rejects.toThrow('SOMETHING_NEW message');
  });

  it('reads an ended session as ended, and an answer without its dial as malformed', async () => {
    answer({ requestId: 'REQ-1', nodeId: 'node/1', session: { status: 'ENDED', viewers: [] } });
    await expect(service.watch(SESSION_ID)).rejects.toBeInstanceOf(WatchEndedError);
    answer({ requestId: null, nodeId: 'node/1', session: { status: 'ACTIVE', viewers: [] } });
    await expect(service.watch(SESSION_ID)).rejects.toThrow('Malformed watch answer');
    expect(new WatchDisabledError('X', '')).toBeInstanceOf(Error);
  });
});

describe('parseWatchEvent', () => {
  it('pins the event names the backend sends', () => {
    expect(WATCH_EVENT_TYPES).toEqual({
      joined: 'REMOTE_SESSION_VIEWER_JOINED',
      left: 'REMOTE_SESSION_VIEWER_LEFT',
      ended: 'REMOTE_SESSION_ENDED',
    });
  });

  it('reads the full viewers list of a join or a leave, and the end', () => {
    for (const type of ['REMOTE_SESSION_VIEWER_JOINED', 'REMOTE_SESSION_VIEWER_LEFT']) {
      expect(
        parseWatchEvent(
          { type, sessionId: SESSION_ID, viewer: viewer('b'), viewers: [viewer('a'), viewer('b')] },
          SESSION_ID,
        ),
      ).toEqual({
        kind: 'viewers',
        viewers: [
          { userId: 'a', name: 'Name a', avatarUrl: null },
          { userId: 'b', name: 'Name b', avatarUrl: null },
        ],
      });
    }
    expect(parseWatchEvent({ type: 'REMOTE_SESSION_ENDED', sessionId: SESSION_ID }, SESSION_ID)).toEqual({
      kind: 'ended',
    });
  });

  it('ignores another session, another type and a body without the list', () => {
    const joined = { type: 'REMOTE_SESSION_VIEWER_JOINED', sessionId: SESSION_ID, viewers: [] };
    expect(parseWatchEvent({ ...joined, sessionId: 'other' }, SESSION_ID)).toBeNull();
    expect(parseWatchEvent({ ...joined, type: 'REMOTE_SESSION_STARTED' }, SESSION_ID)).toBeNull();
    expect(parseWatchEvent({ type: 'REMOTE_SESSION_VIEWER_LEFT', sessionId: SESSION_ID }, SESSION_ID)).toBeNull();
    expect(parseWatchEvent(null, SESSION_ID)).toBeNull();
  });
});
