/**
 * The Remote Control page learns a session runs unrecorded (storage full)
 * from the session record. A poll answer that differs only in that mark must
 * still replace the record the page holds, or the banner never shows. Who is
 * watching comes the same way: with every viewer event on the technician's
 * subject, and with the poll when an event was missed.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSession } from '../types/remote-access';
import { useRemoteSession } from './use-remote-session';

const service = vi.hoisted(() => ({ active: vi.fn(), get: vi.fn(), end: vi.fn(), endOnUnload: vi.fn() }));
const nats = vi.hoisted(() => ({ onPayload: null as ((payload: unknown) => void) | null }));

vi.mock('../services/remote-session-api-service', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  remoteSessionApiService: service,
}));
// The real module carries graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('@flamingo-stack/openframe-frontend-core/nats', () => ({
  useNatsJsonSubscription: (_subject: string | null, onPayload: (payload: unknown) => void) => {
    nats.onPayload = onPayload;
  },
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'tech-1' } }),
}));

const SESSION: RemoteSession = {
  sessionId: 'session-1',
  requestId: 'request-1',
  sessionKind: 'desktop',
  status: 'ACTIVE',
  startedAt: '2026-10-08T10:00:00.000Z',
  recordingEnabled: true,
  recordingSuppressed: null,
  dialogId: null,
  viewers: [],
};

const DANA = { userId: 'tech-dana', name: 'Dana', avatarUrl: null };
const ILONA = { userId: 'tech-ilona', name: 'Ilona', avatarUrl: 'https://cdn/ilona.png' };

let container: HTMLDivElement;
let root: Root;

/** Renders what the page would read: the session, its not-recorded mark ('' while none) and who is watching. */
function Probe() {
  const { session } = useRemoteSession('machine-1', 'request-1');
  return (
    <span
      data-session={session?.sessionId ?? ''}
      data-suppressed={session?.recordingSuppressed ?? ''}
      data-viewers={session?.viewers.map(viewer => viewer.userId).join(',') ?? ''}
    />
  );
}

const probe = () => container.querySelector('span');

async function render() {
  await act(async () => {
    root.render(<Probe />);
    await Promise.resolve();
  });
}

/** A viewer event as the backend sends it: the full current list, with the session's fields beside it. */
function viewerEvent(
  type: 'REMOTE_SESSION_VIEWER_JOINED' | 'REMOTE_SESSION_VIEWER_LEFT',
  sessionId: string,
  viewers: object[],
) {
  act(() =>
    nats.onPayload?.({
      type,
      sessionId,
      requestId: 'request-1',
      deviceId: 'machine-1',
      viewers: viewers.map(viewer => ({ ...viewer, joinedAt: '2026-10-08T10:01:00Z', leftAt: null })),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.end.mockResolvedValue(undefined);
  nats.onPayload = null;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useRemoteSession', () => {
  it('takes up a poll answer that only adds the storage-full mark', async () => {
    service.active.mockResolvedValue(SESSION);
    service.get.mockResolvedValue({ ...SESSION, recordingSuppressed: 'storage_full' });

    await act(async () => {
      root.render(<Probe />);
      await Promise.resolve();
    });
    expect(probe()?.dataset.session).toBe('session-1');
    expect(probe()?.dataset.suppressed).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(probe()?.dataset.suppressed).toBe('storage_full');
  });

  it("follows who is watching from each viewer event of this session, and ignores another session's", async () => {
    service.active.mockResolvedValue(SESSION);
    await render();
    expect(probe()?.dataset.viewers).toBe('');

    viewerEvent('REMOTE_SESSION_VIEWER_JOINED', 'session-1', [DANA, ILONA]);
    expect(probe()?.dataset.viewers).toBe('tech-dana,tech-ilona');
    viewerEvent('REMOTE_SESSION_VIEWER_LEFT', 'session-other', []);
    expect(probe()?.dataset.viewers).toBe('tech-dana,tech-ilona');
    viewerEvent('REMOTE_SESSION_VIEWER_LEFT', 'session-1', [ILONA]);
    expect(probe()?.dataset.viewers).toBe('tech-ilona');
  });

  it('leaves a viewer event alone until the session is known', async () => {
    service.active.mockReturnValue(new Promise(() => {}));
    await render();
    viewerEvent('REMOTE_SESSION_VIEWER_JOINED', 'session-1', [DANA]);
    expect(probe()?.dataset.session).toBe('');
  });

  it('takes up a poll answer that only changes who is watching (a missed event)', async () => {
    service.active.mockResolvedValue(SESSION);
    service.get.mockResolvedValue({ ...SESSION, viewers: [DANA] });
    await render();
    expect(probe()?.dataset.viewers).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(probe()?.dataset.viewers).toBe('tech-dana');
  });
});
