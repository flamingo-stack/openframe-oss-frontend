import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeshCentralFileManager } from './file-manager';
import type { FileEntry, FileOperationRequest } from './file-manager-types';
import { FileDeleteError } from './file-operations';
import type { MeshControlClient } from './meshcentral-control';

const tunnel = vi.hoisted(() => ({
  sent: [] as string[],
  starts: 0,
  onBinaryData: (_bytes: Uint8Array): void => {},
  onStateChange: (_state: number): void => {},
}));

vi.mock('./meshcentral-tunnel', () => ({
  MeshTunnel: class {
    constructor(options: { onBinaryData: (bytes: Uint8Array) => void; onStateChange: (state: number) => void }) {
      tunnel.onBinaryData = options.onBinaryData;
      tunnel.onStateChange = options.onStateChange;
    }
    start() {
      tunnel.starts++;
    }
    stop() {}
    getState() {
      return 3;
    }
    sendText(text: string) {
      tunnel.sent.push(text);
    }
  },
}));

const controlClient = {
  openSession: () => Promise.resolve(),
  getAuthCookies: () => Promise.resolve({ authCookie: 'auth', relayCookie: 'relay' }),
} as unknown as MeshControlClient;

async function connect() {
  tunnel.sent.length = 0;
  tunnel.starts = 0;
  const manager = new MeshCentralFileManager({ isRemote: true, nodeId: 'node', controlClient });
  await manager.connect();
  return manager;
}

async function sentFrames(count: number) {
  await vi.waitFor(() => expect(tunnel.sent).toHaveLength(count));
  return tunnel.sent.map(text => JSON.parse(text) as FileOperationRequest);
}

// The agent answers ls with a Buffer that carries no action field.
function answerListing(ls: FileOperationRequest, dir: FileEntry[]) {
  tunnel.onBinaryData(new TextEncoder().encode(JSON.stringify({ path: '', dir, reqid: ls.reqid })));
}

describe('MeshCentralFileManager.deleteItems', () => {
  it('sends rm, then its own ls, and resolves when nothing requested is still listed', async () => {
    const manager = await connect();
    const outcome = manager.deleteItems(['01-plain.txt'], true);
    const [rm, ls] = await sentFrames(2);

    expect(rm).toMatchObject({ action: 'rm', delfiles: ['01-plain.txt'], rec: true });
    expect(ls.action).toBe('ls');

    answerListing(ls, [{ n: 'other.txt', t: 3 }]);
    await expect(outcome).resolves.toBeUndefined();
  });

  it('rejects with FileDeleteError when a requested name is still listed', async () => {
    const manager = await connect();
    const outcome = manager.deleteItems(['04-locked-uchg.txt'], true);
    const [, ls] = await sentFrames(2);

    answerListing(ls, [{ n: '04-locked-uchg.txt', t: 3 }]);
    await expect(outcome).rejects.toBeInstanceOf(FileDeleteError);
  });

  it('lists again while another load of the same folder is in flight', async () => {
    const manager = await connect();
    const earlierLoad = manager.loadDirectory('');
    const outcome = manager.deleteItems(['01-plain.txt'], true);
    const [load, , ls] = await sentFrames(3);

    // The earlier load was sent before the rm, so its listing still has the file.
    answerListing(load, [{ n: '01-plain.txt', t: 3 }]);
    await earlierLoad;

    answerListing(ls, []);
    await expect(outcome).resolves.toBeUndefined();
  });
});

describe('MeshCentralFileManager.navigateToPath', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a new tunnel and lists again when the listing times out', async () => {
    vi.useFakeTimers();
    const manager = await connect();
    const outcome = manager.navigateToPath('/tmp');
    expect(tunnel.sent).toHaveLength(1);

    tunnel.sent.length = 0;
    await vi.advanceTimersByTimeAsync(8000);
    await vi.waitFor(() => expect(tunnel.starts).toBe(2));
    tunnel.onStateChange(3);

    const [ls] = await sentFrames(1);
    expect(ls).toMatchObject({ action: 'ls', path: '/tmp' });
    answerListing(ls, [{ n: 'a.txt', t: 3 }]);
    await expect(outcome).resolves.toEqual([{ n: 'a.txt', t: 3 }]);
  });

  it('goes to failed when the new tunnel does not open', async () => {
    vi.useFakeTimers();
    const manager = await connect();
    const outcome = manager.navigateToPath('/tmp').catch((error: Error) => error);

    await vi.advanceTimersByTimeAsync(8000 + 15000);
    expect(await outcome).toMatchObject({ message: 'Reconnect timed out' });
    expect(manager.getState()).toBe('failed');
  });
});
