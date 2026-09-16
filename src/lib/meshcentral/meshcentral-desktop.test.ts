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
