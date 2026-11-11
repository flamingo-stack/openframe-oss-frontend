/**
 * The live session page: a running session reads LIVE with its meta card, the host's bar and its time counting up;
 * the "not being recorded" banner shows only when the session has it. The chat follows the session's dialog live,
 * read-only and from the host's side, and shows once it has a line, also after the end. While it runs the host's screen
 * is watched: the bar names the display shown and who is watching, the meta card the screen's resolution, and a
 * watch that gave up offers a retry. An ended session turns into the recording's processing screen and, once a file is
 * listed, hands over to the recording page. A session the server does not show is a 404.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionNotFoundError } from '../../services/session-recordings-service';
import type { RemoteSessionChatMessage, RemoteSessionChatTechnician } from '../../types/remote-session-chat';
import type { LiveSessionDetail } from '../../types/session-recording';
import { LiveSessionView } from './live-session-view';

const NOW = Date.parse('2026-10-29T09:05:18.000Z');

const live = vi.hoisted(() => ({
  data: undefined as LiveSessionDetail | undefined,
  error: null as Error | null,
  refetch: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const watch = vi.hoisted(() => ({
  args: vi.fn<(sessionId: string | null, live: boolean) => void>(),
  state: 'connecting' as 'connecting' | 'streaming' | 'unavailable' | 'ended',
  viewers: [] as { userId: string; name: string | null; avatarUrl: string | null }[],
  display: null as number | null,
  resolution: null as { width: number; height: number } | null,
  retry: vi.fn(),
}));
const auth = vi.hoisted(() => ({ userId: 'tech-maria' as string | null }));
const chat = vi.hoisted(() => ({
  args: vi.fn<(dialogId: string | null, panelOpen: boolean, host?: RemoteSessionChatTechnician) => void>(),
  messages: [] as RemoteSessionChatMessage[],
  send: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('../../hooks/use-remote-session-chat', () => ({
  useRemoteSessionChat: (dialogId: string | null, panelOpen: boolean, host?: RemoteSessionChatTechnician) => {
    chat.args(dialogId, panelOpen, host);
    return {
      messages: chat.messages,
      isLoading: false,
      sending: false,
      technician: host,
      send: chat.send,
      hasUnread: false,
      markRead: chat.markRead,
    };
  },
}));

vi.mock('../../hooks/use-remote-session-watch', () => ({
  useRemoteSessionWatch: (sessionId: string | null, isLive: boolean) => {
    watch.args(sessionId, isLive);
    return {
      state: watch.state,
      viewers: watch.viewers,
      display: watch.display,
      resolution: watch.resolution,
      attachCanvas: () => {},
      retry: watch.retry,
    };
  },
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (s: { user: { id: string } | null }) => unknown) =>
    select({ user: auth.userId ? { id: auth.userId } : null }),
}));

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
  dialogId: 'dialog-1',
  ...overrides,
});

const USER_LINE: RemoteSessionChatMessage = {
  id: 'm-1',
  author: 'user',
  authorName: 'User',
  sentAt: '2026-10-29T09:01:00.000Z',
  body: 'ok',
};
const HOST_LINE: RemoteSessionChatMessage = {
  id: 'seq-7',
  author: 'technician',
  authorName: 'Roman Smith',
  sentAt: '2026-10-29T09:02:00.000Z',
  body: 'Let me check',
  seq: 7,
};

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<LiveSessionView sessionId="session-1" />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  live.data = undefined;
  live.error = null;
  watch.state = 'connecting';
  watch.viewers = [];
  watch.display = null;
  watch.resolution = null;
  auth.userId = 'tech-maria';
  chat.messages = [];
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

  it('watches the running session and tells the watch once it ended', () => {
    live.data = session();
    render();
    expect(watch.args).toHaveBeenLastCalledWith('session-1', true);
    live.data = session({ live: false });
    render();
    expect(watch.args).toHaveBeenLastCalledWith('session-1', false);
  });

  it('connects first, then draws the screen with the display shown and the resolution', () => {
    live.data = session();
    render();
    expect(container.textContent).toContain('Connecting to the live session');
    expect(container.querySelector('canvas')?.className).toContain('invisible');

    watch.state = 'streaming';
    watch.display = 2;
    watch.resolution = { width: 1280, height: 720 };
    render();
    expect(container.textContent).not.toContain('Connecting to the live session');
    expect(container.querySelector('canvas')?.className).not.toContain('invisible');
    expect(container.textContent).toContain('Display 2');
    expect(container.textContent).toContain('1280 × 720');
  });

  it('lists the host first and marks the signed-in watcher, the host watching from another tab once', () => {
    live.data = session();
    watch.state = 'streaming';
    watch.viewers = [
      { userId: 'tech-roman', name: 'Roman Smith', avatarUrl: null },
      { userId: 'tech-maria', name: 'Maria Pizzeria', avatarUrl: null },
      { userId: 'tech-ilona', name: null, avatarUrl: null },
    ];
    render();
    const stack = container.querySelector('[aria-label^="In this session"]');
    expect(stack?.getAttribute('aria-label')).toBe(
      'In this session: Roman Smith (host), Maria Pizzeria (you), Technician',
    );
  });

  it('offers a retry once the watch gave up', () => {
    live.data = session();
    watch.state = 'unavailable';
    render();
    expect(container.textContent).toContain('Live view unavailable');
    const retry = [...container.querySelectorAll('button')].find(b => b.textContent === 'Retry');
    act(() => retry?.click());
    expect(watch.retry).toHaveBeenCalledTimes(1);
  });

  it("follows the session's dialog as the host's chat, read-only and never marking it read", () => {
    live.data = session();
    render();
    expect(chat.args).toHaveBeenLastCalledWith('dialog-1', true, { name: 'Roman Smith', avatarUrl: undefined });
    expect(container.textContent).not.toMatch(/session chat/i);
    expect(chat.markRead).not.toHaveBeenCalled();
  });

  it('shows each line beside the stream as the chat delivers it, without reading the session again', () => {
    live.data = session();
    chat.messages = [USER_LINE];
    render();
    expect(container.textContent).toMatch(/session chat/i);
    expect(container.textContent).toContain('Live Session');
    expect(container.textContent).toContain('ok');

    chat.messages = [USER_LINE, HOST_LINE];
    render();
    expect(container.textContent).toContain('Let me check');
    expect(live.refetch).not.toHaveBeenCalled();
    // A watcher cannot post: no composer, nothing sent, nothing marked read.
    expect(container.querySelector('textarea, input[type="text"]')).toBeNull();
    expect(chat.send).not.toHaveBeenCalled();
    expect(chat.markRead).not.toHaveBeenCalled();
  });

  it('follows no chat when the backend provisioned none', () => {
    live.data = session({ dialogId: null });
    render();
    expect(chat.args).toHaveBeenLastCalledWith(null, true, { name: 'Roman Smith', avatarUrl: undefined });
    expect(container.textContent).not.toMatch(/session chat/i);
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

  it('keeps the chat beside the processing screen', () => {
    live.data = session({ live: false });
    chat.messages = [USER_LINE, HOST_LINE];
    render();
    expect(chat.args).toHaveBeenLastCalledWith('dialog-1', true, { name: 'Roman Smith', avatarUrl: undefined });
    expect(container.textContent).toMatch(/session chat/i);
    expect(container.textContent).toContain('Let me check');
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
