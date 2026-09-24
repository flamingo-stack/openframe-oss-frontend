import { describe, expect, it } from 'vitest';
import { McrecParseError, parseMcrec } from './mcrec-parser';
import { stitchRecordings } from './mcrec-stitch';
import { MCREC_FLAG_BINARY, MCREC_FLAG_FROM_BROWSER, MCREC_RECORD_TYPE, type ParsedRecording } from './mcrec-types';

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

function concat(parts: Uint8Array[]): ArrayBuffer {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
}

const T0 = 1_700_000_000_000;

interface Entry {
  atMs: number;
  byte: number;
  fromBrowser?: boolean;
}

/** One mesh segment: metadata, the given network records, and an end record 5 s after the last one. */
function segment(startMs: number, entries: Entry[], protocol = 2): ParsedRecording {
  const metadata = new TextEncoder().encode(JSON.stringify({ magic: 'MeshCentralRelaySession', ver: 1, protocol }));
  const lastMs = entries.length > 0 ? entries[entries.length - 1].atMs : startMs;
  return parseMcrec(
    concat([
      record(MCREC_RECORD_TYPE.METADATA, 0, startMs, metadata),
      ...entries.map(e =>
        record(
          MCREC_RECORD_TYPE.NETWORK_DATA,
          MCREC_FLAG_BINARY | (e.fromBrowser ? MCREC_FLAG_FROM_BROWSER : 0),
          e.atMs,
          new Uint8Array([e.byte]),
        ),
      ),
      record(MCREC_RECORD_TYPE.END, 0, lastMs + 5000, new TextEncoder().encode('MeshCentralMCREC')),
    ]),
  );
}

const agentBytes = (r: ParsedRecording) => r.agentRecords.map(a => a.data[0]);
const agentOffsets = (r: ParsedRecording) => r.agentRecords.map(a => a.timeMs - r.baseTimeMs);

describe('stitchRecordings', () => {
  it('orders segments by start time and appends their agent records segment by segment', () => {
    const later = segment(T0 + 10_000, [
      { atMs: T0 + 10_000, byte: 3 },
      { atMs: T0 + 10_500, byte: 4 },
    ]);
    const earlier = segment(T0, [
      { atMs: T0, byte: 1 },
      { atMs: T0 + 9_000, byte: 2 },
    ]);

    const stitched = stitchRecordings([later, earlier]);
    expect(agentBytes(stitched)).toEqual([1, 2, 3, 4]);
    expect(stitched.baseTimeMs).toBe(T0);
    expect(stitched.metadata).toBe(earlier.metadata);
    expect(stitched.records).toHaveLength(earlier.records.length + later.records.length);
  });

  it('shortens a reconnect gap above the cap and shifts everything after it, browser records included', () => {
    const first = segment(T0, [
      { atMs: T0, byte: 1 },
      { atMs: T0 + 1000, byte: 2 },
    ]);
    const second = segment(T0 + 31_000, [
      { atMs: T0 + 31_000, byte: 3 },
      { atMs: T0 + 31_200, byte: 9, fromBrowser: true },
      { atMs: T0 + 32_000, byte: 4 },
    ]);

    const stitched = stitchRecordings([first, second], { maxGapMs: 3000 });
    expect(agentOffsets(stitched)).toEqual([0, 1000, 4000, 5000]);
    expect(stitched.durationMs).toBe(5000);
    expect(stitched.segmentStartsMs).toEqual([4000]);
    const browserRecord = stitched.records.find(r => (r.flags & MCREC_FLAG_FROM_BROWSER) !== 0);
    expect(browserRecord?.timeMs).toBe(T0 + 4200);
    // The inputs are left untouched.
    expect(second.agentRecords[0].timeMs).toBe(T0 + 31_000);
  });

  it('keeps a reconnect gap at or under the cap and any silence inside a segment', () => {
    const first = segment(T0, [
      { atMs: T0, byte: 1 },
      { atMs: T0 + 120_000, byte: 2 },
    ]);
    const second = segment(T0 + 122_000, [{ atMs: T0 + 122_000, byte: 3 }]);

    const stitched = stitchRecordings([first, second], { maxGapMs: 3000 });
    expect(agentOffsets(stitched)).toEqual([0, 120_000, 122_000]);
    expect(stitched.segmentStartsMs).toEqual([122_000]);
  });

  it('uses a 3 s cap by default', () => {
    const first = segment(T0, [{ atMs: T0, byte: 1 }]);
    const second = segment(T0 + 60_000, [{ atMs: T0 + 60_000, byte: 2 }]);
    expect(agentOffsets(stitchRecordings([first, second]))).toEqual([0, 3000]);
  });

  it('pushes an overlapping segment to start right after the previous one, keeping segment order', () => {
    const first = segment(T0, [
      { atMs: T0, byte: 1 },
      { atMs: T0 + 5000, byte: 2 },
    ]);
    const overlapping = segment(T0 + 4000, [
      { atMs: T0 + 4000, byte: 3 },
      { atMs: T0 + 4500, byte: 4 },
    ]);

    const stitched = stitchRecordings([first, overlapping]);
    expect(agentBytes(stitched)).toEqual([1, 2, 3, 4]);
    expect(agentOffsets(stitched)).toEqual([0, 5000, 5000, 5500]);
  });

  it('ignores segments without agent records unless there is nothing else', () => {
    const empty = segment(T0 + 500, []);
    const real = segment(T0 + 2000, [{ atMs: T0 + 2000, byte: 1 }]);

    const stitched = stitchRecordings([empty, real]);
    expect(agentBytes(stitched)).toEqual([1]);
    expect(stitched.baseTimeMs).toBe(T0 + 2000);
    expect(stitched.segmentStartsMs).toEqual([]);

    const onlyEmpty = stitchRecordings([empty]);
    expect(onlyEmpty.agentRecords).toHaveLength(0);
    expect(onlyEmpty.durationMs).toBe(0);
  });

  it('returns a single segment unchanged', () => {
    const only = segment(T0, [
      { atMs: T0, byte: 1 },
      { atMs: T0 + 40_000, byte: 2 },
    ]);
    const stitched = stitchRecordings([only]);
    expect(stitched.agentRecords).toEqual(only.agentRecords);
    expect(stitched.durationMs).toBe(40_000);
    expect(stitched.segmentStartsMs).toEqual([]);
  });

  it('rejects an empty list and segments of different protocols', () => {
    expect(() => stitchRecordings([])).toThrow(McrecParseError);
    const desktop = segment(T0, [{ atMs: T0, byte: 1 }]);
    const terminal = segment(T0 + 1000, [{ atMs: T0 + 1000, byte: 2 }], 1);
    expect(() => stitchRecordings([desktop, terminal])).toThrow(McrecParseError);
  });
});
