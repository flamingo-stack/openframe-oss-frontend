import { McrecParseError } from './mcrec-parser';
import type { McrecRecord, ParsedRecording } from './mcrec-types';

/** A reconnect gap between two segments longer than this is shortened to this length in the timeline. */
export const DEFAULT_MAX_SEGMENT_GAP_MS = 3000;

export interface StitchOptions {
  /** Longest reconnect gap kept as-is; defaults to {@link DEFAULT_MAX_SEGMENT_GAP_MS}. */
  maxGapMs?: number;
}

/** Joins one session's segments into a single timeline; every file opens with a full redraw, so streams just follow. */
export function stitchRecordings(segments: ParsedRecording[], options: StitchOptions = {}): ParsedRecording {
  if (segments.length === 0) throw new McrecParseError('No recording segments to stitch');
  const protocol = segments[0].protocol;
  if (segments.some(s => s.protocol !== protocol)) throw new McrecParseError('Recording segments mix protocols');
  const maxGapMs = options.maxGapMs ?? DEFAULT_MAX_SEGMENT_GAP_MS;

  // A segment without agent records (a pairing that never relayed a frame) adds nothing to playback.
  const playable = segments.filter(s => s.agentRecords.length > 0);
  const ordered = [...(playable.length > 0 ? playable : [segments[0]])].sort((a, b) => a.baseTimeMs - b.baseTimeMs);

  const baseTimeMs = ordered[0].baseTimeMs;
  const records: McrecRecord[] = [];
  const agentRecords: McrecRecord[] = [];
  const segmentStartsMs: number[] = [];
  // Cumulative ms subtracted from every timestamp of the current segment; grows at each shortened gap.
  let shift = 0;
  let previousLastMs: number | null = null;

  for (const segment of ordered) {
    const first = segment.agentRecords[0];
    if (first && previousLastMs != null) {
      const gap = first.timeMs - previousLastMs;
      // Overlapping segments (negative gap) are pushed to start right after the previous one.
      if (gap > maxGapMs) shift += gap - maxGapMs;
      else if (gap < 0) shift += gap;
      segmentStartsMs.push(first.timeMs - shift - baseTimeMs);
    }
    const rebase = (r: McrecRecord): McrecRecord => (shift === 0 ? r : { ...r, timeMs: r.timeMs - shift });
    for (const r of segment.records) records.push(rebase(r));
    for (const r of segment.agentRecords) agentRecords.push(rebase(r));
    const last = segment.agentRecords[segment.agentRecords.length - 1];
    if (last) previousLastMs = last.timeMs;
  }

  const lastTimeMs = agentRecords[agentRecords.length - 1]?.timeMs ?? baseTimeMs;
  return {
    metadata: ordered[0].metadata,
    records,
    agentRecords,
    baseTimeMs,
    durationMs: Math.max(0, lastTimeMs - baseTimeMs),
    protocol,
    segmentStartsMs,
  };
}
