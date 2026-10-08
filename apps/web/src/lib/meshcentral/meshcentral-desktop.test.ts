import { describe, expect, it } from 'vitest';
import { MeshDesktop } from './meshcentral-desktop';

function capture(): { desktop: MeshDesktop; frames: Uint8Array[] } {
  const desktop = new MeshDesktop();
  const frames: Uint8Array[] = [];
  desktop.setSender(bytes => frames.push(bytes));
  // setSender fires the KVM init handshake; only the frames after it matter here.
  frames.length = 0;
  return { desktop, frames };
}

const SAS_FRAME = [0x00, 0x0a, 0x00, 0x04];

describe('MeshDesktop.sendKeyCombo', () => {
  it.each(['ctrl+alt+del', 'alt+ctrl+del'])('sends %s as the single MNG_CTRLALTDEL command', combo => {
    const { desktop, frames } = capture();
    desktop.sendKeyCombo(combo);
    expect(frames.map(f => [...f])).toEqual([SAS_FRAME]);
  });

  it('sends other combos as key press/release events', () => {
    const { desktop, frames } = capture();
    desktop.sendKeyCombo('win+m');
    expect(frames).toHaveLength(4);
    expect(frames.every(f => f[1] !== 0x0a)).toBe(true);
  });
});

describe('MeshDesktop.onBinaryFrame', () => {
  /** A header-only KVM frame: cmd, total size, then x/y. */
  function frame(cmd: number, size: number, x = 0, y = 0): Uint8Array {
    return new Uint8Array([cmd >> 8, cmd & 0xff, size >> 8, size & 0xff, x >> 8, x & 0xff, y >> 8, y & 0xff]);
  }

  function renderOnly(): { desktop: MeshDesktop; canvas: HTMLCanvasElement } {
    const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    const desktop = new MeshDesktop();
    desktop.attachRenderOnly(canvas);
    return { desktop, canvas };
  }

  it('applies a screen size frame', async () => {
    const { desktop, canvas } = renderOnly();
    await desktop.onBinaryFrame(frame(7, 8, 1512, 949));
    expect([canvas.width, canvas.height]).toEqual([1512, 949]);
  });

  it('drops a frame that claims a size below its header instead of looping on it, then recovers', async () => {
    const { desktop, canvas } = renderOnly();
    await desktop.onBinaryFrame(frame(7, 0, 800, 600));
    expect(canvas.width).toBe(0);
    await desktop.onBinaryFrame(frame(7, 8, 1280, 720));
    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
  });
});

describe('MeshDesktop.beginStream', () => {
  // KVM command 7 (screen size) is the one command whose effect shows without a 2D context.
  const SCREEN_SIZE_800x600 = new Uint8Array([0x00, 0x07, 0x00, 0x08, 0x03, 0x20, 0x02, 0x58]);
  // The head of a 100-byte tile (command 3) whose relay dropped before the rest arrived.
  const TRUNCATED_TILE = new Uint8Array([0x00, 0x03, 0x00, 0x64, 0x00, 0x00]);

  function renderOnly(): { desktop: MeshDesktop; canvas: HTMLCanvasElement } {
    const canvas = document.createElement('canvas');
    canvas.getContext = () => null;
    const desktop = new MeshDesktop();
    desktop.attachRenderOnly(canvas);
    return { desktop, canvas };
  }

  it('drops the command a dropped relay left half-received', async () => {
    const { desktop, canvas } = renderOnly();
    await desktop.onBinaryFrame(TRUNCATED_TILE);
    desktop.beginStream();
    await desktop.onBinaryFrame(SCREEN_SIZE_800x600);
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
  });

  it('would otherwise parse the next relay as the tail of that command', async () => {
    const { desktop, canvas } = renderOnly();
    await desktop.onBinaryFrame(TRUNCATED_TILE);
    await desktop.onBinaryFrame(SCREEN_SIZE_800x600);
    expect(canvas.width).not.toBe(800);
  });
});

describe('MeshDesktop displays', () => {
  const ALL = 0xffff;

  /** Display list (cmd 11): the ids, then the display the agent streams now. */
  function displayList(ids: number[], selected: number): Uint8Array {
    const words = [ids.length, ...ids, selected];
    const size = 4 + words.length * 2;
    return new Uint8Array([0x00, 0x0b, size >> 8, size & 0xff, ...words.flatMap(w => [w >> 8, w & 0xff])]);
  }

  /** Display locations (cmd 82): 10 bytes per display, x / y signed. */
  function displayLocations(rects: Array<[id: number, x: number, y: number, w: number, h: number]>): Uint8Array {
    const size = 4 + rects.length * 10;
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 82);
    view.setUint16(2, size);
    rects.forEach(([id, x, y, w, h], i) => {
      const at = 4 + i * 10;
      view.setUint16(at, id);
      view.setInt16(at + 2, x);
      view.setInt16(at + 4, y);
      view.setUint16(at + 6, w);
      view.setUint16(at + 8, h);
    });
    return bytes;
  }

  /** The display ids the desktop asked the agent to switch to (cmd 12). */
  function switches(frames: Uint8Array[]): number[] {
    return frames.filter(f => f[1] === 0x0c).map(f => (f[4] << 8) | f[5]);
  }

  function connected() {
    const canvas = document.createElement('canvas');
    canvas.getContext = () => null;
    const desktop = new MeshDesktop();
    desktop.attachRenderOnly(canvas);
    const frames: Uint8Array[] = [];
    desktop.setSender(bytes => frames.push(bytes));
    frames.length = 0;
    const updates: Array<{ ids: number[]; current: number | null }> = [];
    desktop.onDisplayListChange((list, current) => updates.push({ ids: list.map(d => d.id), current }));
    return { desktop, frames, updates };
  }

  it('reads every display of a location message, with negative offsets, and takes the one at 0,0 as primary', async () => {
    const { desktop } = connected();
    await desktop.onBinaryFrame(
      displayLocations([
        [1, -1920, 0, 1920, 1080],
        [2, 0, 0, 2560, 1440],
        [3, 2560, -360, 1080, 1920],
      ]),
    );
    expect(desktop.getDisplayList()).toEqual([
      { id: 1, x: -1920, y: 0, w: 1920, h: 1080, primary: false },
      { id: 2, x: 0, y: 0, w: 2560, h: 1440, primary: true },
      { id: 3, x: 2560, y: -360, w: 1080, h: 1920, primary: false },
    ]);
  });

  it('never lists the all-displays view and switches an agent streaming it to the primary display', async () => {
    const { desktop, frames, updates } = connected();
    await desktop.onBinaryFrame(
      displayLocations([
        [1, -1920, 0, 1920, 1080],
        [2, 0, 0, 2560, 1440],
      ]),
    );
    await desktop.onBinaryFrame(displayList([1, 2, ALL], ALL));
    expect(desktop.getDisplayList().map(d => d.id)).toEqual([1, 2]);
    expect(switches(frames)).toEqual([2]);
    expect(updates.at(-1)).toEqual({ ids: [1, 2], current: 2 });
  });

  it('switches a fresh relay back to the display the technician picked', async () => {
    const { desktop, frames } = connected();
    await desktop.onBinaryFrame(displayList([1, 2, 3], 1));
    desktop.switchDisplay(3);
    desktop.beginStream();
    await desktop.onBinaryFrame(displayList([1, 2, 3], 1));
    expect(switches(frames)).toEqual([3, 3]);
  });

  it('follows the agent when it already streams the target and offers nothing to pick with one display', async () => {
    const { desktop, frames, updates } = connected();
    await desktop.onBinaryFrame(displayList([1], 1));
    expect(switches(frames)).toEqual([]);
    expect(updates.at(-1)).toEqual({ ids: [1], current: 1 });
  });

  it('ignores a location message whose size is not a whole number of displays', async () => {
    const { desktop } = connected();
    const torn = displayLocations([[1, 0, 0, 1920, 1080]]);
    const header = new Uint8Array([0x00, 82, 0x00, 16]);
    await desktop.onBinaryFrame(new Uint8Array([...header, ...torn.subarray(4), 0x00, 0x01]));
    expect(desktop.getDisplayList()).toEqual([]);
  });
});
