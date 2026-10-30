import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeekFrame } from './mcrec-types';
import { DesktopRecordingRenderer } from './renderers';

vi.mock('@/lib/meshcentral/meshcentral-desktop', () => ({
  MeshDesktop: class {
    attachRenderOnly() {}
    detach() {}
    onBinaryFrame() {}
    waitForIdle() {
      return Promise.resolve();
    }
  },
}));

interface FakeBitmap {
  id: number;
  close: ReturnType<typeof vi.fn>;
}

/** Decodes that finish only when the test says so, one per tile, in the order they were asked for. */
let decodes: Array<{ bitmap: FakeBitmap; resolve: () => void; reject: () => void }>;
let drawImage: ReturnType<typeof vi.fn>;
let canvas: HTMLCanvasElement;

const frame: SeekFrame = {
  width: 64,
  height: 32,
  tiles: [
    { x: 0, y: 0, jpeg: new Uint8Array([1]) },
    { x: 32, y: 0, jpeg: new Uint8Array([2]) },
    { x: 0, y: 16, jpeg: new Uint8Array([3]) },
  ],
};

beforeEach(() => {
  decodes = [];
  drawImage = vi.fn();
  canvas = { width: 300, height: 150, getContext: () => ({ drawImage }) } as unknown as HTMLCanvasElement;
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(
      () =>
        new Promise<FakeBitmap>((resolve, reject) => {
          const bitmap = { id: decodes.length, close: vi.fn() };
          decodes.push({ bitmap, resolve: () => resolve(bitmap), reject: () => reject(new Error('corrupt tile')) });
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Lets the decode pool pick up every tile, then settles them last to first. */
async function settleBackwards(fail: number[] = []) {
  await vi.waitFor(() => expect(decodes).toHaveLength(frame.tiles.length));
  for (const decode of [...decodes].reverse()) {
    if (fail.includes(decode.bitmap.id)) decode.reject();
    else decode.resolve();
  }
}

describe('DesktopRecordingRenderer.paint', () => {
  it('keeps the old picture until every tile has decoded, then clears to the size and draws in stream order', async () => {
    const renderer = new DesktopRecordingRenderer(canvas);
    const painting = renderer.paint(frame);
    await vi.waitFor(() => expect(decodes).toHaveLength(3));
    expect(drawImage).not.toHaveBeenCalled();
    expect([canvas.width, canvas.height]).toEqual([300, 150]);

    await settleBackwards();
    await painting;
    expect([canvas.width, canvas.height]).toEqual([64, 32]);
    expect(drawImage.mock.calls.map(([bitmap, x, y]) => [(bitmap as FakeBitmap).id, x, y])).toEqual([
      [0, 0, 0],
      [1, 32, 0],
      [2, 0, 16],
    ]);
    expect(decodes.every(d => d.bitmap.close.mock.calls.length === 1)).toBe(true);
  });

  it('refuses to paint when a tile does not decode, so the player replays', async () => {
    const renderer = new DesktopRecordingRenderer(canvas);
    const painting = renderer.paint(frame);
    await settleBackwards([1]);
    await expect(painting).rejects.toThrow();
    expect(drawImage).not.toHaveBeenCalled();
    expect([canvas.width, canvas.height]).toEqual([300, 150]);
    expect(decodes.filter(d => d.bitmap.id !== 1).every(d => d.bitmap.close.mock.calls.length === 1)).toBe(true);
  });

  it('draws nothing when the next seek starts before the tiles have decoded', async () => {
    const renderer = new DesktopRecordingRenderer(canvas);
    const painting = renderer.paint(frame);
    renderer.reset();
    await settleBackwards();
    await painting;
    expect(drawImage).not.toHaveBeenCalled();
    expect([canvas.width, canvas.height]).toEqual([300, 150]);
    expect(decodes.every(d => d.bitmap.close.mock.calls.length === 1)).toBe(true);
  });

  it('refuses to paint where the browser cannot decode images, so the player replays', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    await expect(new DesktopRecordingRenderer(canvas).paint(frame)).rejects.toThrow();
    expect(drawImage).not.toHaveBeenCalled();
  });
});
