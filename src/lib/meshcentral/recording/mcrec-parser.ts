import {
  MCREC_FLAG_FROM_BROWSER,
  MCREC_RECORD_TYPE,
  type McrecMetadata,
  type McrecRecord,
  type ParsedRecording,
} from './mcrec-types';

const HEADER_BYTES = 16;

export class McrecParseError extends Error {}

/**
 * Reads the 48-bit big-endian ms-since-epoch timestamp at `offset`.
 * 2^48 ms is ~8900 years, so the value always fits a JS number exactly.
 */
function readInt48(view: DataView, offset: number): number {
  return view.getUint16(offset, false) * 2 ** 32 + view.getUint32(offset + 2, false);
}

/**
 * Parse a `.mcrec` buffer into its record stream. Tolerant at the tail - a
 * recording cut mid-record (crashed relay) keeps every complete record -
 * but strict about the head: the first record must be the
 * `MeshCentralRelaySession` metadata JSON, otherwise the file is not a mesh
 * recording at all.
 */
export function parseMcrec(buffer: ArrayBuffer): ParsedRecording {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (bytes.length < HEADER_BYTES) {
    throw new McrecParseError('File is too small to be a MeshCentral recording');
  }

  const records: McrecRecord[] = [];
  let offset = 0;
  while (offset + HEADER_BYTES <= bytes.length) {
    const type = view.getUint16(offset, false);
    const flags = view.getUint16(offset + 2, false);
    const size = view.getUint32(offset + 4, false);
    const timeMs = readInt48(view, offset + 10);

    const payloadStart = offset + HEADER_BYTES;
    if (payloadStart + size > bytes.length) break; // truncated tail record
    records.push({ type, flags, timeMs, data: bytes.subarray(payloadStart, payloadStart + size) });
    offset = payloadStart + size;
  }

  const first = records[0];
  if (!first || first.type !== MCREC_RECORD_TYPE.METADATA) {
    throw new McrecParseError('Recording does not start with a metadata record');
  }

  let metadata: McrecMetadata;
  try {
    metadata = JSON.parse(new TextDecoder().decode(first.data)) as McrecMetadata;
  } catch {
    throw new McrecParseError('Recording metadata is not valid JSON');
  }
  if (metadata.magic !== 'MeshCentralRelaySession') {
    throw new McrecParseError('Recording metadata magic mismatch');
  }

  const protocol = Number(metadata.protocol) === 1 ? 1 : 2;

  const agentRecords = records.filter(
    r => r.type === MCREC_RECORD_TYPE.NETWORK_DATA && (r.flags & MCREC_FLAG_FROM_BROWSER) === 0 && r.data.length > 0,
  );

  const baseTimeMs = agentRecords[0]?.timeMs ?? first.timeMs;
  const lastTimeMs = agentRecords[agentRecords.length - 1]?.timeMs ?? baseTimeMs;

  return {
    metadata,
    records,
    agentRecords,
    baseTimeMs,
    durationMs: Math.max(0, lastTimeMs - baseTimeMs),
    protocol,
  };
}
