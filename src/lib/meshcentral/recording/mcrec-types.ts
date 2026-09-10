// MeshCentral `.mcrec` session-recording format (CU-86akc3ce5).
//
// A recording is a stream of records, each a 16-byte big-endian header followed
// by `size` payload bytes:
//   offset 0  type   uint16  1=metadata(JSON) 2=network-data 3=end 4=index
//   offset 2  flags  uint16  0x1=binary payload  0x2=from browser (else agent)
//   offset 4  size   uint32  payload length
//   offset 10 time   int48   ms since epoch
// Desktop (protocol 2) network-data payloads are the raw KVM binary stream the
// live viewer already decodes (`MeshDesktop.onBinaryFrame`); terminal
// (protocol 1) payloads are raw bytes for xterm.

export const MCREC_RECORD_TYPE = {
  METADATA: 1,
  NETWORK_DATA: 2,
  END: 3,
  INDEX: 4,
} as const;

export const MCREC_FLAG_BINARY = 0x1;
export const MCREC_FLAG_FROM_BROWSER = 0x2;

export interface McrecRecord {
  type: number;
  flags: number;
  /** Absolute ms since epoch from the record header. */
  timeMs: number;
  /** Payload as a subarray view into the source buffer - never a copy. */
  data: Uint8Array;
}

/** The first record's JSON payload. Fields beyond these are tool-internal. */
export interface McrecMetadata {
  magic?: string;
  ver?: number;
  /** 1 = terminal, 2 = desktop/KVM. */
  protocol?: number;
  time?: number;
  [key: string]: unknown;
}

export interface ParsedRecording {
  metadata: McrecMetadata;
  /** Every parsed record, in file order. */
  records: McrecRecord[];
  /** Agent-to-browser network-data records - the only ones a renderer replays. */
  agentRecords: McrecRecord[];
  /** Timeline zero: the first agent record's header time. */
  baseTimeMs: number;
  durationMs: number;
  /** 1 = terminal, 2 = desktop. */
  protocol: 1 | 2;
}

export type RecordingPlayerState = 'empty' | 'ready' | 'playing' | 'paused' | 'seeking' | 'ended';

export type RecordingPlaybackSpeed = 0.5 | 1 | 2 | 4;

/**
 * Rendering backend for one protocol. `reset()` returns the surface to the
 * pre-first-record state (the player replays from zero on every seek);
 * `feed()` consumes one agent-record payload; `waitForIdle()` resolves when
 * everything fed so far is fully decoded and presented.
 */
export interface RecordingRenderer {
  reset(): void | Promise<void>;
  feed(data: Uint8Array): void;
  waitForIdle(): Promise<void>;
  dispose(): void;
}
