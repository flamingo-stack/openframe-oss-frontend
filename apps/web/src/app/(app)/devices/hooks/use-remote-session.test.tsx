/**
 * The Remote Control page learns a session runs unrecorded (storage full)
 * from the session record. A poll answer that differs only in that mark must
 * still replace the record the page holds, or the banner never shows.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSession } from '../types/remote-access';
import { useRemoteSession } from './use-remote-session';

const service = vi.hoisted(() => ({ active: vi.fn(), get: vi.fn(), end: vi.fn(), endOnUnload: vi.fn() }));

vi.mock('../services/remote-session-api-service', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  remoteSessionApiService: service,
}));
// The real module carries graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('@flamingo-stack/openframe-frontend-core/nats', () => ({ useNatsJsonSubscription: () => {} }));
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
};

let container: HTMLDivElement;
let root: Root;

/** Renders what the page would read: the session's not-recorded mark ('' while none). */
function Probe() {
  const { session } = useRemoteSession('machine-1', 'request-1');
  return <span data-session={session?.sessionId ?? ''} data-suppressed={session?.recordingSuppressed ?? ''} />;
}

const probe = () => container.querySelector('span');

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.end.mockResolvedValue(undefined);
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
});
