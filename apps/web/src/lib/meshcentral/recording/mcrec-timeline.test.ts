/**
 * A server time lands where the player shows that moment: inside a file it
 * keeps its distance from the file's frames, in a reconnect gap the kept part
 * plays on and the cut part snaps to the next file, and outside the recording
 * it pins to the nearest end.
 */
import { describe, expect, it } from 'vitest';
import { toPlaybackMs } from './mcrec-timeline';

const T0 = 1_700_000_000_000;

// Two files: 0-1 s, then a 30 s reconnect gap cut to 3 s, then 31-32 s (plays at 4-5 s).
const stitched = {
  baseTimeMs: T0,
  durationMs: 5000,
  spans: [
    { startMs: T0, endMs: T0 + 1000, shiftMs: 0 },
    { startMs: T0 + 31_000, endMs: T0 + 32_000, shiftMs: 27_000 },
  ],
};

describe('toPlaybackMs', () => {
  it('places a time inside a file at its distance from the first frame, later files moved back by the cut', () => {
    expect(toPlaybackMs(stitched, T0 + 500)).toBe(500);
    expect(toPlaybackMs(stitched, T0 + 31_500)).toBe(4500);
  });

  it('plays on through the kept part of a gap and snaps the cut part to the next file', () => {
    expect(toPlaybackMs(stitched, T0 + 2500)).toBe(2500);
    expect(toPlaybackMs(stitched, T0 + 20_000)).toBe(4000);
  });

  it('pins a time before the first frame to the start and one after the last frame to the end', () => {
    expect(toPlaybackMs(stitched, T0 - 3000)).toBe(0);
    expect(toPlaybackMs(stitched, T0 + 90_000)).toBe(5000);
  });

  it('reads a single file without spans as one file that was not moved', () => {
    const single = { baseTimeMs: T0, durationMs: 40_000 };
    expect(toPlaybackMs(single, T0 + 12_345)).toBe(12_345);
    expect(toPlaybackMs(single, T0 + 50_000)).toBe(40_000);
  });
});
