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
