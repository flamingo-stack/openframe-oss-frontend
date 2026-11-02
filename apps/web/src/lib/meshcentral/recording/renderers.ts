import type { Terminal } from '@xterm/xterm';
import { MeshDesktop } from '@/lib/meshcentral/meshcentral-desktop';
import type { RecordingRenderer, SeekFrame, SeekTile } from './mcrec-types';

/** Tiles of a painted frame decoded at once. */
const PAINT_DECODE_CONCURRENCY = 8;

/**
 * Replays protocol-2 (desktop/KVM) payloads onto a canvas through the same
 * `MeshDesktop` decoder the live viewer uses. `reset()` swaps in a FRESH
 * decoder instance: the player seeks by replaying from record zero, and a new
 * instance guarantees no jumbo-frame accumulator, tile queue, or display state
 * leaks across seeks. Attached render-only, so no input listeners are bound
 * and nothing is ever sent (no `setSender` call - `send()` is a no-op).
 */
export class DesktopRecordingRenderer implements RecordingRenderer {
  private desktop: MeshDesktop | null = null;
  /** Bumped by every reset, so a paint still decoding when the next seek starts draws nothing. */
  private generation = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  reset(): void {
    this.generation++;
    this.desktop?.detach();
    this.desktop = new MeshDesktop();
    this.desktop.attachRenderOnly(this.canvas);
  }

  /** Decodes every tile first and only then clears and draws, so the old picture stays up until the new one is whole. */
  async paint(frame: SeekFrame): Promise<void> {
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is not available');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Player canvas has no 2D context');
    this.reset();
    const generation = this.generation;
    const bitmaps = await decodeTiles(frame.tiles);
    try {
      if (generation !== this.generation) return;
      // A tile that does not decode would leave a hole where the replay keeps what was under it.
      if (bitmaps.includes(null)) throw new Error('A tile did not decode');
      // Setting the size clears the canvas, as the stream's own screen-size command does.
      this.canvas.width = frame.width;
      this.canvas.height = frame.height;
      for (const [index, tile] of frame.tiles.entries()) ctx.drawImage(bitmaps[index] as ImageBitmap, tile.x, tile.y);
    } finally {
      for (const bitmap of bitmaps) bitmap?.close();
    }
  }

  feed(data: Uint8Array): void {
    void this.desktop?.onBinaryFrame(data);
  }

  waitForIdle(): Promise<void> {
    return this.desktop?.waitForIdle() ?? Promise.resolve();
  }

  dispose(): void {
    this.generation++;
    this.desktop?.detach();
    this.desktop = null;
  }
}

/** One bitmap per tile, in tile order; null for a tile that does not decode. */
async function decodeTiles(tiles: readonly SeekTile[]): Promise<Array<ImageBitmap | null>> {
  const bitmaps: Array<ImageBitmap | null> = new Array(tiles.length).fill(null);
  let next = 0;
  const work = async () => {
    while (next < tiles.length) {
      const index = next++;
      try {
        const blob = new Blob([tiles[index].jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
        bitmaps[index] = await createImageBitmap(blob);
      } catch {
        bitmaps[index] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PAINT_DECODE_CONCURRENCY, tiles.length) }, work));
  return bitmaps;
}

/**
 * Replays protocol-1 (terminal) payloads into an xterm instance the caller
 * owns (created with `disableStdin: true`). Payloads are raw terminal bytes -
 * `Terminal.write` accepts `Uint8Array` directly in xterm 6.
 */
export class TerminalRecordingRenderer implements RecordingRenderer {
  constructor(private readonly terminal: Terminal) {}

  reset(): void {
    this.terminal.reset();
  }

  feed(data: Uint8Array): void {
    this.terminal.write(data);
  }

  waitForIdle(): Promise<void> {
    // xterm buffers writes internally; a write callback resolves once the
    // last chunk fed so far has been processed.
    return new Promise(resolve => {
      this.terminal.write(new Uint8Array(0), resolve);
    });
  }

  dispose(): void {
    // The terminal is owned by the caller (page component) - nothing to do.
  }
}
