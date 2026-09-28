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
