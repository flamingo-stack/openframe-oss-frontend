import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeshControlClient } from './meshcentral-control';
import { MeshTunnel } from './meshcentral-tunnel';

vi.mock('../token-refresh-manager', () => ({
  isTokenRefreshing: () => false,
  refreshAccessToken: () => Promise.resolve(true),
  waitForRefresh: () => Promise.resolve(true),
}));

vi.mock('./meshcentral-config', () => ({
  buildWsUrl: (path: string) => `wss://mesh.test${path}`,
  MESH_USER: '',
  MESH_PASS: '',
}));

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  binaryType = 'arraybuffer';
  sent: unknown[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.({});
  }

  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: '', wasClean: false });
  }

  get relayId(): string | null {
    return new URL(this.url).searchParams.get('id');
  }

  /** Relay ids this control socket asked the agent to dial. */
  get tunnelRequests(): string[] {
    return this.sent
      .map(data => (typeof data === 'string' ? JSON.parse(data) : null))
      .filter(msg => msg?.action === 'msg' && msg.type === 'tunnel')
      .map(msg => new URL(String(msg.value).slice(2), 'wss://mesh.test').searchParams.get('id') as string);
  }
}

const latest = (path: string) => FakeSocket.instances.filter(s => s.url.includes(path)).at(-1) as FakeSocket;
const control = () => latest('/control.ashx');
const relay = () => latest('/meshrelay.ashx');

function authcookie(socket: FakeSocket) {
  socket.receive({ action: 'authcookie', cookie: 'auth', rcookie: 'relay' });
}

/** A shell page's wiring (remote-shell/page.tsx), minus React. */
function openShell(ctrl: MeshControlClient) {
  const tunnel = new MeshTunnel({
    authCookie: 'auth',
    nodeId: 'node',
    protocol: 1,
    onData: () => {},
    onRequestPairing: (relayId, tunnelKey) => {
      ctrl.sendRelayTunnel(tunnelKey, 'node', relayId, 1);
      ctrl.openSession().catch(() => {});
    },
    onStateChange: (s, tunnelKey) => {
      if (s === 0) ctrl.forgetTunnel(tunnelKey);
    },
  });
  tunnel.start();
  return tunnel;
}

describe('MeshControlClient tunnel requests', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function connectControl(ctrl: MeshControlClient) {
    const session = ctrl.openSession();
    control().open();
    authcookie(control());
    await vi.advanceTimersByTimeAsync(200);
    await session;
  }

  it.each([
    ['the relay comes back first', 'relay-first'],
    ['the control socket comes back first', 'control-first'],
  ] as const)('asks once per reconnect for the current relay when %s', async (_, order) => {
    const ctrl = new MeshControlClient();
    await connectControl(ctrl);
    const tunnel = openShell(ctrl);
    relay().open();
    expect(control().tunnelRequests).toEqual([relay().relayId]);

    for (let i = 0; i < 5; i++) {
      relay().drop();
      control().drop();
      await vi.advanceTimersByTimeAsync(60_000);

      if (order === 'relay-first') {
        relay().open();
        await vi.advanceTimersByTimeAsync(0);
        control().open();
      } else {
        control().open();
        authcookie(control());
        relay().open();
      }
      // A cookie refresh on the same socket asks for nothing new.
      authcookie(control());
      authcookie(control());
      await vi.advanceTimersByTimeAsync(200);

      expect(control().tunnelRequests).toEqual([relay().relayId]);
    }

    tunnel.stop();
    ctrl.close();
  });

  it('asks again for the waiting relay after a control-only reconnect, and only for it', async () => {
    const ctrl = new MeshControlClient();
    await connectControl(ctrl);
    const tunnel = openShell(ctrl);
    relay().open();
    const relayId = relay().relayId;

    control().drop();
    await vi.advanceTimersByTimeAsync(60_000);
    control().open();
    authcookie(control());

    expect(control().tunnelRequests).toEqual([relayId]);

    tunnel.stop();
    ctrl.close();
  });

  it('asks for nothing once the tunnel stopped', async () => {
    const ctrl = new MeshControlClient();
    await connectControl(ctrl);
    const tunnel = openShell(ctrl);
    relay().open();
    tunnel.stop();

    control().drop();
    await vi.advanceTimersByTimeAsync(60_000);
    control().open();
    authcookie(control());

    expect(control().tunnelRequests).toEqual([]);

    ctrl.close();
  });
});
