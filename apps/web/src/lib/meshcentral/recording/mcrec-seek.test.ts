import { describe, expect, it } from 'vitest';
import { readJpegSize, seekFrame } from './mcrec-seek';
import type { McrecRecord, ParsedRecording, SeekFrame } from './mcrec-types';

const T0 = 1_700_000_000_000;

/** A JPEG that is only its headers: SOI, an APP0 segment, a frame header with the size, EOI. */
function jpeg(width: number, height: number, frameMarker = 0xc0): Uint8Array {
  return new Uint8Array([
    ...[0xff, 0xd8],
    ...[0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46],
    ...[0xff, frameMarker, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03],
    ...[0xff, 0xd9],
  ]);
}

function screen(width: number, height: number): Uint8Array {
  return new Uint8Array([0x00, 0x07, 0x00, 0x08, width >> 8, width & 0xff, height >> 8, height & 0xff]);
}

function tile(x: number, y: number, image: Uint8Array): Uint8Array {
  const size = 8 + image.length;
  return new Uint8Array([0x00, 0x03, size >> 8, size & 0xff, x >> 8, x & 0xff, y >> 8, y & 0xff, ...image]);
}

function jumbo(frame: Uint8Array): Uint8Array {
  const size = frame.length;
  return new Uint8Array([0x00, 0x1b, 0x00, 0x08, 0x00, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...frame]);
}

/** A session of one or more files, one agent record per entry, every file a restart point. */
function session(...files: Uint8Array[][]): ParsedRecording {
  const agentRecords: McrecRecord[] = [];
  const restartIndices: number[] = [];
  for (const file of files) {
    restartIndices.push(agentRecords.length);
    for (const data of file) agentRecords.push({ type: 2, flags: 1, timeMs: T0 + agentRecords.length, data });
  }
  return {
    metadata: {},
    records: agentRecords,
    agentRecords,
    baseTimeMs: T0,
    durationMs: agentRecords.length - 1,
    protocol: 2,
    restartIndices,
  };
}

/** Where each drawn tile lands and how wide its image is, in draw order. */
function drawn(frame: SeekFrame | null) {
  return frame?.tiles.map(t => [t.x, t.y, readJpegSize(t.jpeg)?.width ?? 0]);
}

describe('readJpegSize', () => {
  it('reads the size from a baseline or a progressive frame header', () => {
    expect(readJpegSize(jpeg(320, 64))).toEqual({ width: 320, height: 64 });
    expect(readJpegSize(jpeg(32, 1024, 0xc2))).toEqual({ width: 32, height: 1024 });
  });

  it('skips a Huffman table, whose marker sits among the frame headers', () => {
    const image = jpeg(64, 32);
    const withTable = new Uint8Array([0xff, 0xd8, 0xff, 0xc4, 0x00, 0x04, 0x00, 0x00, ...image.subarray(2)]);
    expect(readJpegSize(withTable)).toEqual({ width: 64, height: 32 });
  });

  it('gives up on bytes that are not a JPEG, a cut header or a size the header does not carry', () => {
    expect(readJpegSize(new Uint8Array([0x7b, 0x22, 0x63, 0x74]))).toBeNull();
    expect(readJpegSize(jpeg(64, 32).subarray(0, 12))).toBeNull();
    expect(readJpegSize(jpeg(64, 0))).toBeNull();
  });
});

describe('seekFrame', () => {
  it('leaves out a tile that later tiles paint over completely', () => {
    const recording = session([screen(64, 32), tile(0, 0, jpeg(32, 32)), tile(0, 0, jpeg(64, 32))]);
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([[0, 0, 64]]);
  });

  it('keeps a tile that a later one covers only in part, in stream order', () => {
    const recording = session([screen(64, 32), tile(0, 0, jpeg(64, 32)), tile(0, 0, jpeg(32, 32))]);
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([
      [0, 0, 64],
      [0, 0, 32],
    ]);
  });

  it('lets a cell hide what is under it only when one tile paints it whole', () => {
    const recording = session([
      screen(32, 16),
      tile(0, 0, jpeg(32, 16)),
      tile(8, 0, jpeg(24, 16)),
      tile(0, 0, jpeg(8, 16)),
    ]);
    expect(drawn(seekFrame(recording, 0, 3))).toEqual([
      [0, 0, 32],
      [8, 0, 24],
      [0, 0, 8],
    ]);
  });

  it('counts the part of a cell inside the screen when a tile runs off its edge', () => {
    const recording = session([screen(40, 16), tile(32, 0, jpeg(8, 16)), tile(32, 0, jpeg(32, 16))]);
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([[32, 0, 32]]);
  });

  it('always draws a tile whose size cannot be read, and lets it hide nothing', () => {
    const unreadable = new Uint8Array([0xff, 0xd8, 0x00, 0x00]);
    const recording = session([screen(32, 32), tile(0, 0, jpeg(32, 32)), tile(0, 0, unreadable)]);
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([
      [0, 0, 32],
      [0, 0, 0],
    ]);
  });

  it('starts over at the last screen-size change, at the new size', () => {
    const recording = session([screen(32, 32), tile(0, 0, jpeg(32, 32)), screen(64, 32), tile(32, 0, jpeg(32, 32))]);
    const frame = seekFrame(recording, 0, 3);
    expect(frame && [frame.width, frame.height]).toEqual([64, 32]);
    expect(drawn(frame)).toEqual([[32, 0, 32]]);
  });

  it('ignores a screen-size command without a size, as the decoder does', () => {
    const recording = session([screen(32, 32), tile(0, 0, jpeg(32, 32)), screen(0, 0)]);
    const frame = seekFrame(recording, 0, 2);
    expect(frame?.width).toBe(32);
    expect(drawn(frame)).toEqual([[0, 0, 32]]);
  });

  it('stops at the target record', () => {
    const recording = session([screen(32, 32), tile(0, 0, jpeg(16, 32)), tile(0, 0, jpeg(32, 32))]);
    expect(drawn(seekFrame(recording, 0, 1))).toEqual([[0, 0, 16]]);
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([[0, 0, 32]]);
  });

  it('reads a tile sent as a jumbo frame', () => {
    const recording = session([screen(32, 32), jumbo(tile(0, 0, jpeg(32, 32)))]);
    expect(drawn(seekFrame(recording, 0, 1))).toEqual([[0, 0, 32]]);
  });

  it('leaves a target inside a command split across records to the replay', () => {
    const split = tile(0, 0, jpeg(32, 32));
    const recording = session([screen(32, 32), split.subarray(0, 10), split.subarray(10)]);
    expect(seekFrame(recording, 0, 1)).toBeNull();
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([[0, 0, 32]]);
  });

  it('leaves a file that has not sent its screen size yet to the replay', () => {
    expect(seekFrame(session([tile(0, 0, jpeg(32, 32))]), 0, 0)).toBeNull();
  });

  it('drops a frame shorter than its header and carries on, as the decoder does', () => {
    const recording = session([screen(32, 32), new Uint8Array([0x00, 0x03, 0x00, 0x02]), tile(0, 0, jpeg(32, 32))]);
    expect(drawn(seekFrame(recording, 0, 1))).toEqual([]);
    expect(drawn(seekFrame(recording, 0, 2))).toEqual([[0, 0, 32]]);
  });

  it('rebuilds a later file of a session from that file alone', () => {
    const recording = session([screen(32, 32), tile(0, 0, jpeg(32, 32))], [screen(64, 64), tile(0, 0, jpeg(16, 16))]);
    const later = seekFrame(recording, 2, 3);
    expect(later?.width).toBe(64);
    expect(drawn(later)).toEqual([[0, 0, 16]]);
    expect(drawn(seekFrame(recording, 0, 1))).toEqual([[0, 0, 32]]);
  });
});
