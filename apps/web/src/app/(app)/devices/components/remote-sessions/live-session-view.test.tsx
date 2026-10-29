/**
 * The live session page: a running session reads LIVE with its meta card, the host's bar and its time counting up;
 * the "not being recorded" banner and the chat show only when the session has them. An ended session turns into the
 * recording's processing screen and, once a file is listed, hands over to the recording page. A session the server
 * does not show is a 404.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionNotFoundError } from '../../services/session-recordings-service';
import type { LiveSessionDetail } from '../../types/session-recording';
import { LiveSessionView } from './live-session-view';

const NOW = Date.parse('2026-10-29T09:05:18.000Z');

const live = vi.hoisted(() => ({
  data: undefined as LiveSessionDetail | undefined,
  error: null as Error | null,
  refetch: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('../../hooks/use-session-recordings', () => ({
  useLiveSession: () => ({
    data: live.data,
    error: live.error,
    isError: live.error !== null,
    isPending: live.error === null && !live.data,
    isPaused: false,
    refetch: live.refetch,
  }),
}));
vi.mock('@/app/hooks/use-now', () => ({ useNow: () => NOW }));
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitLocalUpdate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: router.replace, back: vi.fn() }),
  usePathname: () => '/devices/details/live-session',
  useSearchParams: () => new URLSearchParams(),
}));

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const session = (overrides: Partial<LiveSessionDetail> = {}): LiveSessionDetail => ({
  id: 'session-1',
  deviceId: 'machine-1',
  startedAt: '2026-10-29T09:00:00.000Z',
  durationMs: null,
  sizeBytes: null,
  protocol: 2,
  recordingState: 'processing',
  live: true,
  kept: false,
  keep: null,
  expiresAt: null,
  recordingId: null,
  employee: { name: 'Roman Smith' },
  technicianId: 'tech-roman',
  hostname: 'workstation-23.acme.local',
  organization: { id: 'org-1', name: 'Acme Logistics' },
  notRecorded: false,
  chat: [],
  ...overrides,
});

const CHAT = [
  { id: 'm-1', author: 'Anthony Reed', fromTechnician: false, sentAt: '2026-10-29T09:01:00.000Z', body: 'ok' },
  { id: 'm-2', author: 'Roman Smith', fromTechnician: true, sentAt: '2026-10-29T09:02:00.000Z', body: 'Let me check' },
];

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<LiveSessionView sessionId="session-1" />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  live.data = undefined;
  live.error = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('LiveSessionView while the session runs', () => {
  it("reads LIVE with the meta card, the host's bar and the time since the start", () => {
    live.data = session();
    render();
    expect(container.textContent).toContain('Live session');
    expect(container.textContent).toMatch(/live/i);
    expect(container.textContent).toContain('workstation-23.acme.local');
    expect(container.textContent).toContain('Acme Logistics');
    expect(container.textContent).toContain('Roman Smith (host)');
    expect(container.textContent).toContain('05:18');
  });

  it('has no banner and no chat when the session is recorded and the chat was not opened', () => {
    live.data = session();
    render();
    expect(container.textContent).not.toContain("This session isn't being recorded");
    expect(container.textContent).not.toMatch(/session chat/i);
    // The stream's section label goes with the chat; the page title is "Live session".
    expect(container.textContent).not.toContain('Live Session');
  });

  it("says the session isn't being recorded when the recording storage was full", () => {
    live.data = session({ notRecorded: true });
    render();
    expect(container.textContent).toContain(
      "This session isn't being recorded. Recording storage is full. New sessions aren't recorded until space is freed.",
    );
  });

  it('shows the chat so far beside the stream once there is one', () => {
    live.data = session({ chat: CHAT });
    render();
    expect(container.textContent).toMatch(/session chat/i);
    expect(container.textContent).toContain('Live Session');
    expect(container.textContent).toContain('Let me check');
  });
});

describe('LiveSessionView after the session ended', () => {
  it("turns into the recording's processing screen", () => {
    live.data = session({ live: false });
    render();
    expect(container.textContent).toContain('Remote Session Recording');
    expect(container.textContent).toMatch(/processing/i);
    expect(container.textContent).toContain('Session ended');
    expect(container.textContent).toContain('The recording is being processed and will be ready in a few minutes.');
    expect(container.textContent).not.toContain('(host)');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps waiting for the file when the state already counts one the session does not list yet', () => {
    live.data = session({ live: false, recordingState: 'ready', recordingId: null });
    render();
    expect(container.textContent).toMatch(/processing/i);
    expect(container.textContent).toContain('The recording is being processed and will be ready in a few minutes.');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('promises no recording when none is coming', () => {
    live.data = session({ live: false, recordingState: 'none' });
    render();
    expect(container.textContent).toContain('Session ended');
    expect(container.textContent).not.toContain('The recording is being processed');
  });

  it('hands over to the recording page once a file is listed', () => {
    live.data = session({ live: false, recordingState: 'ready', recordingId: 'rec-1' });
    render();
    expect(router.replace).toHaveBeenCalledWith('/devices/details/remote-session?id=rec-1');
  });

  it('keeps a running session here even when a file is already listed', () => {
    live.data = session({ recordingState: 'ready', recordingId: 'rec-1' });
    render();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('LiveSessionView without a session', () => {
  it('shows the 404 for a session the server does not show', () => {
    live.error = new SessionNotFoundError();
    render();
    expect(container.textContent).toContain('Session not found');
    expect(container.textContent).not.toContain("Couldn't load this session.");
  });

  it('keeps the load error with Retry for any other failed read', () => {
    live.error = new Error('Relay fetch timed out');
    render();
    expect(container.textContent).toContain("Couldn't load this session.");
  });
});
