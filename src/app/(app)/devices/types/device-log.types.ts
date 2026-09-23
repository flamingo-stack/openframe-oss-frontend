import type { DeviceLogLevel } from '@/generated/schema-enums';

/**
 * The `deviceLogs` filter as the UI builds it — structurally what the Relay
 * artifact's `DeviceLogFilterInput` accepts, declared here so the tab does not
 * import a shape relay-compiler owns.
 */
export interface DeviceLogFilter {
  /** Any of these; omitted = all levels (the API treats `[]` the same way). */
  levels?: DeviceLogLevel[];
  /** Every term must appear; max 5 terms of 256 characters. */
  contains?: string[];
  /** No term may appear; same limits. */
  excludes?: string[];
  /** Inclusive ISO-8601 instant. Sent alone so the list keeps up with new lines. */
  from?: string;
  /** Inclusive ISO-8601 instant; custom ranges only. */
  to?: string;
}

/** One log line as the tab renders it. */
export interface UiDeviceLog {
  /** The edge cursor — unique per line within a result and stable across renders. */
  key: string;
  /** Pipeline ingest instant, verbatim: the poll's `from` and the nanosecond sort key. */
  timestamp: string;
  /** When the agent wrote the line (device clock — drifts); shown on demand. */
  agentTimestamp: string | null;
  /** Normalised level; anything the API reports outside the four renders as INFO. */
  level: DeviceLogLevel;
  /** The level exactly as reported, for the chip text. */
  rawLevel: string;
  message: string;
  hostname: string | null;
  /** Identical lines the agent collapsed into this one; `null` when not collapsed. */
  count: number | null;
}
