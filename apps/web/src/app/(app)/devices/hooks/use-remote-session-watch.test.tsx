/**
 * Watching a running session: the watch is asked before the socket dials (no mesh login, the watch relay id), again
 * before every redial and every 10 s while the session is healthy. The session's end - the gateway's close, the ENDED
 * event or an ended watch answer - stops the socket for good and reads the session again; failed redials or a refused
 * watch stop with a retry. Who is watching follows every watch answer and viewer event. Nothing goes out while the
 * workspace is locked or the session is not running.
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WatchDisabledError, WatchEndedError } from '../services/remote-session-watch-api-service';
import { useRemoteSessionWatch, WATCH_RENEW_MS } from './use-remote-session-watch';

type TunnelParams = {
  authCookie: string;
  nodeId: string;
  protocol: number;
  relayIdPrefix: string;
  maxReconnectAttempts: number;
  shouldReconnect: (event: { code: number; reason: string }) => boolean;
  onBeforeReconnect: () => Promise<void>;
  onFailed: () => void;
  onStateChange: (state: number) => void;
};

const hooks = vi.hoisted(() => ({
  watch: vi.fn(),
  open: true,
  pollsAllowed: true,
  invalidate: vi.fn(),
  nats: { subject: null as string | null, onPayload: null as ((payload: unknown) => void) | null },
  tunnels: [] as Array<{ params: TunnelParams; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
  desktops: [] as Array<{
    setSender: ReturnType<typeof vi.fn>;
    beginStream: ReturnType<typeof vi.fn>;
    firstFrame: (() => void) | null;
    displays: ((list: unknown[], current: number | null) => void) | null;
    size: ((width: number, height: number) => void) | null;
  }>,
}));

vi.mock('react-relay', () => ({ graphql: () => ({}), commitMutation: vi.fn() }));
vi.mock('../services/remote-session-watch-api-service', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  remoteSessionWatchApiService: { watch: hooks.watch },
}));
const queryClient = vi.hoisted(() => ({ client: null as { invalidateQueries: (args: unknown) => void } | null }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => (queryClient.client ??= { invalidateQueries: (args: unknown) => hooks.invalidate(args) }),
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'tech-maria' } }),
}));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => hooks.open }));
vi.mock('@/lib/session-poll', () => ({ sessionPollsAllowed: () => hooks.pollsAllowed }));
vi.mock('@flamingo-stack/openframe-frontend-core/nats', () => ({
  useNatsJsonSubscription: (subject: string | null, onPayload: (payload: unknown) => void) => {
    hooks.nats.subject = subject;
    hooks.nats.onPayload = onPayload;
  },
}));
vi.mock('@/lib/meshcentral/meshcentral-tunnel', () => ({
  MeshTunnel: class {
    start = vi.fn();
    stop = vi.fn();
    sendBinary = vi.fn();
    constructor(readonly params: TunnelParams) {
      hooks.tunnels.push(this);
    }
  },
}));
vi.mock('@/lib/meshcentral/meshcentral-desktop', () => ({
  MeshDesktop: class {
    setSender = vi.fn();
    beginStream = vi.fn();
    onBinaryFrame = vi.fn();
    attachRenderOnly = vi.fn();
    detach = vi.fn();
    firstFrame: (() => void) | null = null;
    displays: ((list: unknown[], current: number | null) => void) | null = null;
    size: ((width: number, height: number) => void) | null = null;
    constructor() {
      hooks.desktops.push(this);
    }
    onFirstFrame(callback: () => void) {
      this.firstFrame = callback;
    }
    onDisplayListChange(callback: (list: unknown[], current: number | null) => void) {
      this.displays = callback;
    }
    onScreenSizeChange(callback: (width: number, height: number) => void) {
      this.size = callback;
    }
  },
}));

const SESSION_ID = 'session-1';
const GRANT = {
  requestId: 'REQ-1',
  nodeId: 'node/1',
  viewers: [{ userId: 'tech-maria', name: 'Maria', avatarUrl: null }],
};

let container: HTMLDivElement;
let root: Root;
let result: ReturnType<typeof useRemoteSessionWatch>;

function Canvas({ attach }: { attach: (canvas: HTMLCanvasElement | null) => void }) {
  return <canvas ref={attach} />;
}

function Probe({ live = true }: { live?: boolean }) {
  const value = useRemoteSessionWatch(SESSION_ID, live);
  useEffect(() => {
    result = value;
  });
  return <Canvas attach={value.attachCanvas} />;
}

async function render(live = true) {
  await act(async () => {
    root.render(<Probe live={live} />);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function last<T>(list: T[]): T {
  const item = list.at(-1);
  if (!item) throw new Error('nothing was created');
  return item;
}
const tunnel = () => last(hooks.tunnels);
const desktop = () => last(hooks.desktops);

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  hooks.open = true;
  hooks.pollsAllowed = true;
  hooks.tunnels = [];
  hooks.desktops = [];
  hooks.nats = { subject: null, onPayload: null };
  hooks.watch.mockResolvedValue(GRANT);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useRemoteSessionWatch', () => {
  it('asks to watch, then dials the remote screen alone: no mesh login, the watch relay id, view-only', async () => {
    await render();
    expect(hooks.watch).toHaveBeenCalledWith(SESSION_ID);
    expect(hooks.tunnels).toHaveLength(1);
    expect(tunnel().params).toMatchObject({
      authCookie: '',
      nodeId: 'node/1',
      protocol: 2,
      relayIdPrefix: 'REQ-1.w',
      maxReconnectAttempts: 3,
    });
    expect(desktop().setSender).toHaveBeenCalledWith(expect.any(Function), { watch: true });
    expect(tunnel().start).toHaveBeenCalledTimes(1);
    expect(result.state).toBe('connecting');
    expect(result.viewers).toEqual(GRANT.viewers);
    expect(hooks.nats.subject).toBe('user.tech-maria.notification');
  });

  it('starts the stream on each pairing and streams from the first frame, with the display and screen size', async () => {
    await render();
    act(() => tunnel().params.onStateChange(3));
    expect(desktop().beginStream).toHaveBeenCalledTimes(1);
    act(() => {
      desktop().firstFrame?.();
      desktop().displays?.([], 2);
      desktop().size?.(1280, 720);
    });
    expect(result.state).toBe('streaming');
    expect(result.display).toBe(2);
    expect(result.resolution).toEqual({ width: 1280, height: 720 });
    act(() => tunnel().params.onStateChange(1));
    expect(result.state).toBe('connecting');
  });

  it('asks again before every redial, and every 10 s while the session is healthy', async () => {
    await render();
    await act(async () => {
      await tunnel().params.onBeforeReconnect();
    });
    expect(hooks.watch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WATCH_RENEW_MS);
    });
    expect(hooks.watch).toHaveBeenCalledTimes(3);
    hooks.pollsAllowed = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WATCH_RENEW_MS);
    });
    expect(hooks.watch).toHaveBeenCalledTimes(3);
  });

  it("ends for good on the gateway's close and reads the session again", async () => {
    await render();
    expect(tunnel().params.shouldReconnect({ code: 1006, reason: '' })).toBe(true);
    expect(tunnel().params.shouldReconnect({ code: 1008, reason: 'remote access ended' })).toBe(false);
    act(() => tunnel().params.onFailed());
    expect(result.state).toBe('ended');
    expect(tunnel().stop).toHaveBeenCalled();
    expect(hooks.invalidate).toHaveBeenCalledWith({
      queryKey: expect.arrayContaining(['session-recordings', 'live', SESSION_ID]),
    });
    expect(hooks.tunnels).toHaveLength(1);
  });

  it('ends on the ENDED event, and on an ended watch answer before a redial', async () => {
    await render();
    act(() => hooks.nats.onPayload?.({ type: 'REMOTE_SESSION_ENDED', sessionId: SESSION_ID }));
    expect(result.state).toBe('ended');

    act(() => root.unmount());
    root = createRoot(container);
    await render();
    hooks.watch.mockRejectedValueOnce(new WatchEndedError());
    await act(async () => {
      await tunnel().params.onBeforeReconnect();
    });
    expect(result.state).toBe('ended');
    expect(tunnel().stop).toHaveBeenCalled();
  });

  it('stops after the failed redials and dials anew on retry', async () => {
    await render();
    act(() => tunnel().params.onFailed());
    expect(result.state).toBe('unavailable');
    expect(tunnel().stop).toHaveBeenCalled();

    await act(async () => {
      result.retry();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.state).toBe('connecting');
    expect(hooks.watch).toHaveBeenCalledTimes(2);
    expect(hooks.tunnels).toHaveLength(2);
  });

  it('stops with a retry when watching is refused, without dialling', async () => {
    hooks.watch.mockRejectedValueOnce(new WatchDisabledError('REMOTE_SESSION_WATCH_DISABLED', 'off'));
    await render();
    expect(result.state).toBe('unavailable');
    expect(hooks.tunnels).toHaveLength(0);
  });

  it('takes who is watching from each viewer event', async () => {
    await render();
    const viewers = [
      { userId: 'tech-maria', name: 'Maria', avatarUrl: null },
      { userId: 'tech-ilona', name: 'Ilona', avatarUrl: null },
    ];
    act(() => hooks.nats.onPayload?.({ type: 'REMOTE_SESSION_VIEWER_JOINED', sessionId: SESSION_ID, viewers }));
    expect(result.viewers).toEqual(viewers);
    act(() => hooks.nats.onPayload?.({ type: 'REMOTE_SESSION_VIEWER_LEFT', sessionId: 'other', viewers: [] }));
    expect(result.viewers).toEqual(viewers);
  });

  it('sends nothing while the workspace is locked or the session is not running', async () => {
    hooks.open = false;
    await render();
    hooks.open = true;
    act(() => root.unmount());
    root = createRoot(container);
    await render(false);
    expect(hooks.watch).not.toHaveBeenCalled();
    expect(hooks.tunnels).toHaveLength(0);
    expect(hooks.nats.subject).toBeNull();
  });
});
