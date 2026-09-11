import { describe, expect, it } from 'vitest';
import { McrecParseError, parseMcrec } from './mcrec-parser';
import { MCREC_FLAG_BINARY, MCREC_FLAG_FROM_BROWSER, MCREC_RECORD_TYPE } from './mcrec-types';

const METADATA = { magic: 'MeshCentralRelaySession', ver: 1, protocol: 2, time: 1_700_000_000_000 };

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

function metadataRecord(timeMs: number, metadata: object = METADATA): Uint8Array {
  return record(MCREC_RECORD_TYPE.METADATA, 0, timeMs, new TextEncoder().encode(JSON.stringify(metadata)));
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

describe('parseMcrec', () => {
  it('parses records and derives base time and duration from agent network records', () => {
    const buffer = concat([
      metadataRecord(T0),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + 100, new Uint8Array([1, 2, 3])),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + 900, new Uint8Array([4])),
      record(MCREC_RECORD_TYPE.END, 0, T0 + 1000, new Uint8Array(0)),
    ]);

    const parsed = parseMcrec(buffer);
    expect(parsed.records).toHaveLength(4);
    expect(parsed.agentRecords).toHaveLength(2);
    expect(parsed.protocol).toBe(2);
    expect(parsed.baseTimeMs).toBe(T0 + 100);
    expect(parsed.durationMs).toBe(800);
    expect(Array.from(parsed.agentRecords[0].data)).toEqual([1, 2, 3]);
  });

  it('excludes browser-originated records from the replay stream', () => {
    const buffer = concat([
      metadataRecord(T0),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY | MCREC_FLAG_FROM_BROWSER, T0 + 50, new Uint8Array([9])),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + 200, new Uint8Array([1])),
    ]);

    const parsed = parseMcrec(buffer);
    expect(parsed.records).toHaveLength(3);
    expect(parsed.agentRecords).toHaveLength(1);
    expect(parsed.baseTimeMs).toBe(T0 + 200);
  });

  it('keeps complete records when the file is truncated mid-record', () => {
    const full = concat([
      metadataRecord(T0),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + 100, new Uint8Array([1, 2, 3, 4, 5])),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0 + 200, new Uint8Array([6, 7, 8])),
    ]);
    const truncated = full.slice(0, full.byteLength - 2);

    const parsed = parseMcrec(truncated);
    expect(parsed.agentRecords).toHaveLength(1);
    expect(parsed.durationMs).toBe(0);
  });

  it('reads 48-bit timestamps above 2^32 ms', () => {
    const bigTime = 2 ** 40 + 123; // ~2004 in ms-epoch terms, exceeds uint32
    const buffer = concat([
      metadataRecord(bigTime),
      record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, bigTime + 500, new Uint8Array([1])),
    ]);

    const parsed = parseMcrec(buffer);
    expect(parsed.baseTimeMs).toBe(bigTime + 500);
  });

  it('defaults protocol to desktop and falls back to metadata time with no agent records', () => {
    const buffer = concat([metadataRecord(T0, { ...METADATA, protocol: undefined })]);
    const parsed = parseMcrec(buffer);
    expect(parsed.protocol).toBe(2);
    expect(parsed.agentRecords).toHaveLength(0);
    expect(parsed.baseTimeMs).toBe(T0);
    expect(parsed.durationMs).toBe(0);
  });

  it('parses protocol 1 metadata as terminal', () => {
    const buffer = concat([metadataRecord(T0, { ...METADATA, protocol: 1 })]);
    expect(parseMcrec(buffer).protocol).toBe(1);
  });

  it('rejects buffers that do not start with mesh metadata', () => {
    expect(() => parseMcrec(new Uint8Array(8).buffer)).toThrow(McrecParseError);
    expect(() =>
      parseMcrec(concat([record(MCREC_RECORD_TYPE.NETWORK_DATA, MCREC_FLAG_BINARY, T0, new Uint8Array([1]))])),
    ).toThrow(McrecParseError);
    expect(() => parseMcrec(concat([metadataRecord(T0, { magic: 'SomethingElse' })]))).toThrow(McrecParseError);
  });
});
