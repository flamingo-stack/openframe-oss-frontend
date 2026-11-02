import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMcrec } from './mcrec-parser';
import { McrecPlayer } from './mcrec-player';
import { stitchRecordings } from './mcrec-stitch';
import { MCREC_FLAG_BINARY, MCREC_RECORD_TYPE, type RecordingRenderer, type SeekFrame } from './mcrec-types';

// ---- fake clock: vitest fake timers + performance.now kept in lockstep ----

let nowMs = 0;

function advance(ms: number) {
  nowMs += ms;
  vi.advanceTimersByTime(ms);
}

// ---- recording fixture builder (same wire format as the parser tests) ----

function record(type: number, flags: number, timeMs: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(16 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, type, false);
  view.setUint16(2, flags, false);
  view.setUint32(4, payload.length, false);
  view.setUint16(10, Math.floor(timeMs / 2 ** 32), false);
  view.setUint32(12, timeMs % 2 ** 32, false);
  out.set(payload, 16);
  return out;
}

const T0 = 1_700_000_000_000;

/** Recording with one agent record per entry: [offsetMs, payloadByte]. */
function buildRecording(entries: Array<[number, number]>): ArrayBuffer {
  const metadata = new TextEncoder().encode(JSON.stringify({ magic: 'MeshCentralRelaySession', ver: 1, protocol: 2 }));
  const parts = [
    record(MCREC_RECORD_TYPE.METADATA, 0, T0, metadata),
    ...entries.map(([offset, byte]) =>
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + offset, new Uint8Array([byte])),
    ),
  ];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
}

class FakeRenderer implements RecordingRenderer {
  fed: number[] = [];
  resets = 0;
  reset() {
    this.resets++;
    this.fed = [];
  }
  feed(data: Uint8Array) {
    this.fed.push(data[0]);
  }
  waitForIdle() {
    return Promise.resolve();
  }
  dispose() {}
}

beforeEach(() => {
  nowMs = 0;
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('McrecPlayer', () => {
  it('load parses, resets the renderer, and reports ready + duration', () => {
    const renderer = new FakeRenderer();
    const states: string[] = [];
    let duration = 0;
    const player = new McrecPlayer({ onState: s => states.push(s), onDuration: d => (duration = d) });
    player.attachRenderer(renderer);

    player.load(
      buildRecording([
        [0, 1],
        [500, 2],
        [1000, 3],
      ]),
    );

    expect(renderer.resets).toBe(1);
    expect(duration).toBe(1000);
    expect(states).toEqual(['ready']);
    expect(player.durationMs).toBe(1000);
  });

  it('feeds records as the virtual clock passes their timestamps', () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [400, 2],
        [900, 3],
      ]),
    );

    player.play();
    advance(100);
    expect(renderer.fed).toEqual([1]);
    advance(350); // virtual 450
    expect(renderer.fed).toEqual([1, 2]);
    advance(500); // virtual 950 > duration 900 -> ended after final feed
    expect(renderer.fed).toEqual([1, 2, 3]);
    expect(player.state).toBe('ended');
  });

  it('honours playback speed through re-anchoring', () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [1000, 2],
        [2000, 3],
      ]),
    );

    player.play();
    player.setSpeed(4);
    advance(300); // virtual ~1200 at 4x
    expect(renderer.fed).toEqual([1, 2]);
    expect(player.currentMs).toBeGreaterThanOrEqual(1200 - 1);

    player.setSpeed(0.5);
    advance(400); // +200 virtual -> ~1400
    expect(renderer.fed).toEqual([1, 2]);
    advance(1300); // +650 -> ~2050, capped at 2000
    expect(renderer.fed).toEqual([1, 2, 3]);
    expect(player.state).toBe('ended');
  });

  it('pause freezes the virtual clock', () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [1000, 2],
      ]),
    );

    player.play();
    advance(200);
    player.pause();
    const at = player.currentMs;
    advance(5000);
    expect(player.currentMs).toBe(at);
    expect(renderer.fed).toEqual([1]);
    expect(player.state).toBe('paused');
  });

  it('seek replays from a fresh renderer up to the target and lands paused', async () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [400, 2],
        [800, 3],
        [1200, 4],
      ]),
    );

    await player.seek(900);

    expect(renderer.resets).toBe(2); // load + seek
    expect(renderer.fed).toEqual([1, 2, 3]);
    expect(player.currentMs).toBe(900);
    expect(player.state).toBe('paused');

    // Continuing playback picks up from the cursor, no double-feed.
    player.play();
    advance(400); // virtual 1300
    expect(renderer.fed).toEqual([1, 2, 3, 4]);
  });

  it('coalesces concurrent seeks - only the newest one lands', async () => {
    const renderer = new FakeRenderer();
    const idleResolvers: Array<() => void> = [];
    renderer.waitForIdle = () =>
      new Promise<void>(resolve => {
        idleResolvers.push(resolve);
      });

    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [400, 2],
        [800, 3],
      ]),
    );

    const first = player.seek(800); // parks on the final waitForIdle
    await Promise.resolve();
    const second = player.seek(400);
    idleResolvers.shift()?.(); // release the first seek's pending drain - it must abort
    await first;
    idleResolvers.shift()?.();
    await second;

    expect(player.currentMs).toBe(400);
    expect(player.state).toBe('paused');
  });

  it('play from ended restarts from zero', async () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [500, 2],
      ]),
    );

    await player.seek(500);
    expect(player.state).toBe('ended');

    player.play();
    await vi.waitFor(() => expect(player.state).toBe('playing'));
    expect(player.currentMs).toBe(0);
    advance(600);
    expect(player.state).toBe('ended');
  });
});

describe('McrecPlayer over a stitched session', () => {
  // Two files of one session: the second opens (like every file) with its own redraw.
  const first = () =>
    parseMcrec(
      buildRecording([
        [0, 1],
        [1000, 2],
        [2000, 3],
      ]),
    );
  const second = () =>
    parseMcrec(
      buildRecording([
        [3000, 4],
        [4000, 5],
      ]),
    );

  it('replays a seek from the start of the file that holds the target, not from zero', async () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.loadParsed(stitchRecordings([first(), second()]));

    await player.seek(3500);
    expect(renderer.fed).toEqual([4]);

    await player.seek(1500);
    expect(renderer.fed).toEqual([1, 2]);
  });

  it('waits at the end of the loaded part, then carries on from there once the rest arrives', async () => {
    const renderer = new FakeRenderer();
    const states: string[] = [];
    const player = new McrecPlayer({ onState: s => states.push(s) });
    player.attachRenderer(renderer);
    const head = first();
    player.loadParsed(stitchRecordings([head]), { complete: false });

    player.play();
    advance(2500);
    expect(renderer.fed).toEqual([1, 2, 3]);
    expect(player.state).toBe('playing');
    expect(player.currentMs).toBe(2000);

    // Five seconds of waiting must not be skipped once the next file lands.
    advance(5000);
    player.extend(stitchRecordings([head, second()]), true);
    advance(1100);
    // The next file starts on a fresh renderer.
    expect(renderer.fed).toEqual([4]);
    expect(player.currentMs).toBeLessThan(3500);

    advance(2000);
    expect(renderer.fed).toEqual([4, 5]);
    expect(player.state).toBe('ended');
    expect(states).not.toContain('seeking');
  });

  it('lands paused, not ended, on a seek to the end of a session still loading', async () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.loadParsed(stitchRecordings([first()]), { complete: false });

    await player.seek(10_000);
    expect(player.state).toBe('paused');
    expect(player.currentMs).toBe(2000);
  });

  describe('seeking to a time in a file still downloading', () => {
    const third = () =>
      parseMcrec(
        buildRecording([
          [6000, 6],
          [7000, 7],
        ]),
      );

    function loadHead() {
      const renderer = new FakeRenderer();
      const player = new McrecPlayer();
      player.attachRenderer(renderer);
      const head = first();
      player.loadParsed(stitchRecordings([head]), { complete: false });
      return { renderer, player, head };
    }

    it('seeks at once to a time that is already loaded', async () => {
      const { renderer, player } = loadHead();
      await player.seekToTime(T0 + 1500);
      expect(player.state).toBe('paused');
      expect(player.currentMs).toBe(1500);
      expect(renderer.fed).toEqual([1, 2]);
    });

    it('waits at the end of the loaded part, through files that do not hold it, and lands once one does', async () => {
      const { renderer, player, head } = loadHead();
      await player.seekToTime(T0 + 6500);
      expect(player.state).toBe('waiting');
      expect(player.currentMs).toBe(2000);
      expect(renderer.fed).toEqual([1, 2, 3]);

      player.extend(stitchRecordings([head, second()]), false);
      expect(player.state).toBe('waiting');
      expect(player.currentMs).toBe(2000);

      player.extend(stitchRecordings([head, second(), third()]), true);
      await vi.waitFor(() => expect(player.state).toBe('paused'));
      expect(player.currentMs).toBe(6500);
      expect(renderer.fed).toEqual([6]);
    });

    it('stays still while it waits and plays on from the target when it was playing', async () => {
      const { renderer, player, head } = loadHead();
      player.play();
      advance(500);
      await player.seekToTime(T0 + 3500);
      expect(player.state).toBe('waiting');

      advance(5000);
      expect(player.currentMs).toBe(2000);
      player.extend(stitchRecordings([head, second()]), true);
      await vi.waitFor(() => expect(player.state).toBe('playing'));
      expect(player.currentMs).toBe(3500);

      advance(600);
      expect(renderer.fed).toEqual([4, 5]);
    });

    it('drops the wait when the user seeks elsewhere or presses play', async () => {
      const seeking = loadHead();
      await seeking.player.seekToTime(T0 + 3500);
      await seeking.player.seek(500);
      seeking.player.extend(stitchRecordings([seeking.head, second()]), true);
      expect(seeking.player.state).toBe('paused');
      expect(seeking.player.currentMs).toBe(500);

      const playing = loadHead();
      await playing.player.seekToTime(T0 + 3500);
      playing.player.play();
      playing.player.extend(stitchRecordings([playing.head, second()]), true);
      expect(playing.player.state).toBe('playing');
      expect(playing.player.currentMs).toBe(2000);
    });

    it('drops the wait when a new load starts, paused where it is', async () => {
      const { player, head } = loadHead();
      await player.seekToTime(T0 + 3500);
      player.cancelWait();
      expect(player.state).toBe('paused');
      expect(player.currentMs).toBe(2000);

      player.extend(stitchRecordings([head, second()]), true);
      expect(player.state).toBe('paused');
      expect(player.currentMs).toBe(2000);
    });

    it('lands at the end when loading finishes without the file that holds it', async () => {
      const { player, head } = loadHead();
      await player.seekToTime(T0 + 9000);
      player.extend(stitchRecordings([head]), true);
      await vi.waitFor(() => expect(player.state).toBe('ended'));
      expect(player.currentMs).toBe(2000);
    });
  });
});

describe('McrecPlayer at the join of two files', () => {
  it('starts the renderer over where the next file begins, in playback and in a seek replay', async () => {
    const renderer = new FakeRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    const joined = stitchRecordings([
      parseMcrec(
        buildRecording([
          [0, 1],
          [1000, 2],
        ]),
      ),
      parseMcrec(
        buildRecording([
          [2000, 3],
          [3000, 4],
        ]),
      ),
    ]);
    player.loadParsed(joined);
    const resetsAfterLoad = renderer.resets;

    player.play();
    advance(2100);
    // The second file's first record went into a fresh renderer.
    expect(renderer.resets).toBe(resetsAfterLoad + 1);
    expect(renderer.fed).toEqual([3]);

    await player.seek(3500);
    expect(renderer.fed).toEqual([3, 4]);
  });
});

describe('McrecPlayer with a renderer that paints', () => {
  /** A JPEG that is only its headers, so the seek can read its size. */
  function jpeg(width: number, height: number): Uint8Array {
    return new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      height >> 8,
      height & 0xff,
      width >> 8,
      width & 0xff,
      0x03,
    ]);
  }

  const screen = new Uint8Array([0x00, 0x07, 0x00, 0x08, 0x00, 0x20, 0x00, 0x20]);

  function tile(width: number): Uint8Array {
    const image = jpeg(width, 32);
    return new Uint8Array([0x00, 0x03, 0x00, 8 + image.length, 0, 0, 0, 0, ...image]);
  }

  /** A desktop recording with one KVM frame per agent record: [offsetMs, frame]. */
  function desktopRecording(entries: Array<[number, Uint8Array]>): ArrayBuffer {
    const metadata = new TextEncoder().encode(
      JSON.stringify({ magic: 'MeshCentralRelaySession', ver: 1, protocol: 2 }),
    );
    const parts = [
      record(MCREC_RECORD_TYPE.METADATA, 0, T0, metadata),
      ...entries.map(([offset, frame]) =>
        record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + offset, frame),
      ),
    ];
    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out.buffer;
  }

  const desktop = () =>
    desktopRecording([
      [0, screen],
      [100, tile(16)],
      [200, tile(32)],
      [300, tile(16)],
    ]);

  class PaintingRenderer extends FakeRenderer {
    painted: SeekFrame[] = [];
    paint = vi.fn(async (frame: SeekFrame) => {
      this.resets++;
      this.fed = [];
      this.painted.push(frame);
    });
  }

  it("draws the target's screen in one pass instead of replaying, and plays on after it", async () => {
    const renderer = new PaintingRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());

    await player.seek(250);
    expect(renderer.painted).toHaveLength(1);
    expect(renderer.painted[0].tiles).toHaveLength(1);
    expect(renderer.fed).toEqual([]);
    expect(player.state).toBe('paused');
    expect(player.currentMs).toBe(250);

    player.play();
    advance(100);
    expect(renderer.fed).toHaveLength(1);
  });

  it('replays instead when painting fails', async () => {
    const renderer = new PaintingRenderer();
    renderer.paint.mockRejectedValueOnce(new Error('no canvas'));
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());

    await player.seek(250);
    expect(renderer.fed).toHaveLength(3);
    expect(player.state).toBe('paused');
  });

  it('replays a recording whose screen it cannot rebuild', async () => {
    const renderer = new PaintingRenderer();
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(
      buildRecording([
        [0, 1],
        [400, 2],
      ]),
    );

    await player.seek(400);
    expect(renderer.paint).not.toHaveBeenCalled();
    expect(renderer.fed).toEqual([1, 2]);
  });

  it('moves the playhead to the target as soon as the seek starts', async () => {
    const renderer = new PaintingRenderer();
    let finishPaint = () => {};
    renderer.paint.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishPaint = () => resolve();
        }),
    );
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());

    const seek = player.seek(250);
    expect(player.state).toBe('seeking');
    expect(player.currentMs).toBe(250);
    finishPaint();
    await seek;
    expect(player.state).toBe('paused');
  });

  it('lets a newer seek land when an older one is still painting', async () => {
    const renderer = new PaintingRenderer();
    let finishFirst = () => {};
    renderer.paint.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishFirst = () => resolve();
        }),
    );
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());

    const first = player.seek(250);
    await player.seek(120);
    finishFirst();
    await first;
    expect(player.currentMs).toBe(120);
    expect(player.state).toBe('paused');
  });

  it('keeps playing through a seek that takes over from one still running', async () => {
    const renderer = new PaintingRenderer();
    let finishFirst = () => {};
    renderer.paint.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishFirst = () => resolve();
        }),
    );
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());
    player.play();

    const first = player.seek(250);
    await player.seek(120);
    finishFirst();
    await first;
    expect(player.currentMs).toBe(120);
    expect(player.state).toBe('playing');
  });

  it('drops a seek still running when a new recording loads', async () => {
    const renderer = new PaintingRenderer();
    let finishPaint = () => {};
    renderer.paint.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishPaint = () => resolve();
        }),
    );
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());

    const seek = player.seek(250);
    player.load(desktop());
    finishPaint();
    await seek;
    expect(player.state).toBe('ready');
    expect(player.currentMs).toBe(0);
  });

  it('does not start a replay for a seek a new load took over, when its paint fails late', async () => {
    const renderer = new PaintingRenderer();
    let failPaint = () => {};
    renderer.paint.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          failPaint = () => reject(new Error('corrupt tile'));
        }),
    );
    const player = new McrecPlayer();
    player.attachRenderer(renderer);
    player.load(desktop());

    const seek = player.seek(250);
    player.load(desktop());
    const resetsAfterLoad = renderer.resets;
    failPaint();
    await seek;
    expect(renderer.resets).toBe(resetsAfterLoad);
    expect(player.state).toBe('ready');
  });
});
