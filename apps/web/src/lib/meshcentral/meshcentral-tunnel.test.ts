import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeshTunnel } from './meshcentral-tunnel';

vi.mock('../token-refresh-manager', () => ({
  isTokenRefreshing: () => false,
  refreshAccessToken: () => Promise.resolve(true),
  waitForRefresh: () => Promise.resolve(true),
}));

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  binaryType = 'arraybuffer';
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send() {}

  close() {
    this.readyState = FakeSocket.CLOSED;
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.({});
  }

  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: '', wasClean: false });
  }

  closeWith(code: number, reason: string) {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: true });
  }

  get relayId(): string | null {
    return new URL(this.url).searchParams.get('id');
  }
}

describe('MeshTunnel relay id', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dials again under a new id, keeps the prefix, and announces the id it dialled', async () => {
    const announced: string[] = [];
    const tunnel = new MeshTunnel({
      authCookie: 'cookie',
      nodeId: 'node',
      protocol: 2,
      relayIdPrefix: 'REQUEST.2',
      onData: () => {},
      onRequestPairing: relayId => announced.push(relayId),
    });

    tunnel.start();
    const first = FakeSocket.instances[0];
    first.open();
    first.drop();
    await vi.runOnlyPendingTimersAsync();
    const second = FakeSocket.instances[1];
    second.open();

    expect(first.relayId).toMatch(/^REQUEST\.2\../);
    expect(second.relayId).toMatch(/^REQUEST\.2\../);
    expect(second.relayId).not.toBe(first.relayId);
    expect(announced).toEqual([first.relayId, second.relayId]);

    tunnel.stop();
  });
});

describe('MeshTunnel watch relay', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dials without a mesh login, under the watch prefix and a new letters-and-digits nonce each time', async () => {
    const tunnel = new MeshTunnel({
      authCookie: '',
      nodeId: 'node/1',
      protocol: 2,
      relayIdPrefix: 'REQUEST.w',
      onData: () => {},
    });

    tunnel.start();
    const first = FakeSocket.instances[0];
    first.open();
    first.drop();
    await vi.runOnlyPendingTimersAsync();
    const second = FakeSocket.instances[1];

    for (const socket of [first, second]) {
      const params = new URL(socket.url).searchParams;
      expect(params.get('auth')).toBeNull();
      expect(params.get('rauth')).toBeNull();
      expect(params.get('p')).toBe('2');
      expect(params.get('browser')).toBe('1');
      expect(params.get('nodeid')).toBe('node/1');
      expect(socket.relayId).toMatch(/^REQUEST\.w\.[a-z0-9]{1,32}$/);
    }
    expect(second.relayId).not.toBe(first.relayId);

    tunnel.stop();
  });

  it('stops on a close it refuses instead of refreshing the token and dialling again', async () => {
    const onFailed = vi.fn();
    const onBeforeReconnect = vi.fn(() => Promise.resolve());
    const tunnel = new MeshTunnel({
      authCookie: '',
      nodeId: 'node',
      protocol: 2,
      relayIdPrefix: 'REQUEST.w',
      shouldReconnect: event => !(event.code === 1008 && event.reason === 'remote access ended'),
      onBeforeReconnect,
      onFailed,
      onData: () => {},
    });

    tunnel.start();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].closeWith(1008, 'remote access ended');
    await vi.runAllTimersAsync();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(onBeforeReconnect).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
    tunnel.stop();
  });

  it('gives up after the redials it may make, and says so', async () => {
    const onFailed = vi.fn();
    const tunnel = new MeshTunnel({
      authCookie: '',
      nodeId: 'node',
      protocol: 2,
      maxReconnectAttempts: 2,
      onFailed,
      onData: () => {},
    });

    tunnel.start();
    FakeSocket.instances[0].drop();
    await vi.runOnlyPendingTimersAsync();
    FakeSocket.instances[1].drop();
    await vi.runOnlyPendingTimersAsync();
    FakeSocket.instances[2].drop();
    await vi.runAllTimersAsync();

    expect(FakeSocket.instances).toHaveLength(3);
    expect(onFailed).toHaveBeenCalledTimes(1);
    tunnel.stop();
  });
});
