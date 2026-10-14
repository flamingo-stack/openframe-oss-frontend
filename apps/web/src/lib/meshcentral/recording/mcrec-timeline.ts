import type { ParsedRecording, RecordingSpan } from './mcrec-types';

/** What a session timeline needs of a loaded recording to place a server time on it. */
export type RecordingTimeline = Pick<ParsedRecording, 'baseTimeMs' | 'durationMs' | 'spans'>;

/**
 * The player position of a wall-clock time (ms since epoch), on the timeline
 * the stitcher built: a time inside a file plays where that file's records
 * landed; a time in a reconnect gap plays on through the part of the gap that
 * was kept and snaps to the next file's start in the part that was cut; a time
 * before the first frame or after the last one pins to that end.
 */
export function toPlaybackMs(timeline: RecordingTimeline, wallMs: number): number {
  const { baseTimeMs, durationMs } = timeline;
  const spans: RecordingSpan[] = timeline.spans ?? [
    { startMs: baseTimeMs, endMs: baseTimeMs + durationMs, shiftMs: 0 },
  ];
  const clamp = (ms: number) => Math.min(Math.max(0, ms), durationMs);

  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    if (wallMs <= span.endMs) return clamp(wallMs - span.shiftMs - baseTimeMs);
    const next = spans[index + 1];
    if (next && wallMs < next.startMs) {
      return clamp(Math.min(wallMs - span.shiftMs, next.startMs - next.shiftMs) - baseTimeMs);
    }
  }
  return durationMs;
}
