import { describe, expect, it } from 'vitest';
import { McrecParseError } from './mcrec-parser';
import { loadSessionSegments, type SegmentSink } from './mcrec-segment-loader';
import { MCREC_FLAG_BINARY, MCREC_RECORD_TYPE, type ParsedRecording } from './mcrec-types';

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

/** One file with one agent record per [offsetMs, byte]. */
function file(entries: Array<[number, number]>): ArrayBuffer {
  const metadata = new TextEncoder().encode(JSON.stringify({ magic: 'MeshCentralRelaySession', ver: 1, protocol: 2 }));
  const parts = [
    record(MCREC_RECORD_TYPE.METADATA, 0, T0 + (entries[0]?.[0] ?? 0), metadata),
    ...entries.map(([offset, byte]) =>
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + offset, new Uint8Array([byte])),
    ),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
}

const ok = (buffer: ArrayBuffer) => () => Promise.resolve(buffer);
const fails = () => () => Promise.reject(new Error('404'));

interface Call {
  kind: 'start' | 'extend';
  bytes: number[];
  complete: boolean;
}

function recordingSink(current = () => true): SegmentSink & { calls: Call[] } {
  const calls: Call[] = [];
  const bytes = (recording: ParsedRecording) => recording.agentRecords.map(r => r.data[0]);
  return {
    calls,
    isCurrent: current,
    start: (recording, complete) => {
      calls.push({ kind: 'start', bytes: bytes(recording), complete });
    },
    extend: (recording, complete) => {
      calls.push({ kind: 'extend', bytes: bytes(recording), complete });
    },
  };
}

describe('loadSessionSegments', () => {
  it('starts on the first file and grows the session one file at a time', async () => {
    const sink = recordingSink();
    const result = await loadSessionSegments([ok(file([[0, 1]])), ok(file([[1000, 2]])), ok(file([[2000, 3]]))], sink);
    expect(result).toEqual({ failed: 0 });
    expect(sink.calls).toEqual([
      { kind: 'start', bytes: [1], complete: false },
      { kind: 'extend', bytes: [1, 2], complete: false },
      { kind: 'extend', bytes: [1, 2, 3], complete: true },
    ]);
  });

  it('skips a file that fails and still plays the rest', async () => {
    const sink = recordingSink();
    const result = await loadSessionSegments([fails(), ok(file([[1000, 2]])), ok(file([[2000, 3]]))], sink);
    expect(result).toEqual({ failed: 1 });
    expect(sink.calls[0]).toEqual({ kind: 'start', bytes: [2], complete: false });
    expect(sink.calls.at(-1)).toEqual({ kind: 'extend', bytes: [2, 3], complete: true });
  });

  it('marks the session complete when its last file fails', async () => {
    const sink = recordingSink();
    const result = await loadSessionSegments([ok(file([[0, 1]])), fails()], sink);
    expect(result).toEqual({ failed: 1 });
    expect(sink.calls).toEqual([
      { kind: 'start', bytes: [1], complete: false },
      { kind: 'extend', bytes: [1], complete: true },
    ]);
  });

  it('counts a file that is not a recording as failed', async () => {
    const sink = recordingSink();
    const result = await loadSessionSegments([ok(new ArrayBuffer(4)), ok(file([[0, 1]]))], sink);
    expect(result).toEqual({ failed: 1 });
    expect(sink.calls).toEqual([{ kind: 'start', bytes: [1], complete: true }]);
  });

  it('throws the first error when no file loads', async () => {
    await expect(loadSessionSegments([ok(new ArrayBuffer(4)), fails()], recordingSink())).rejects.toBeInstanceOf(
      McrecParseError,
    );
  });

  it('stops feeding once a newer load took over', async () => {
    let current = true;
    const sink = recordingSink(() => current);
    const second = () => {
      current = false;
      return Promise.resolve(file([[1000, 2]]));
    };
    await loadSessionSegments([ok(file([[0, 1]])), second], sink);
    expect(sink.calls).toEqual([{ kind: 'start', bytes: [1], complete: false }]);
  });
});
