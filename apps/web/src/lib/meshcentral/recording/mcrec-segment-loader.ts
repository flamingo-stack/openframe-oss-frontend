import { parseMcrec } from './mcrec-parser';
import { stitchRecordings } from './mcrec-stitch';
import type { ParsedRecording } from './mcrec-types';

/** Where a progressively loaded session goes: the player, behind whatever the caller wires up. */
export interface SegmentSink {
  /** The first file that loaded. `complete` when no other file will follow. */
  start(recording: ParsedRecording, complete: boolean): void | Promise<void>;
  /** The session so far, one more file longer. */
  extend(recording: ParsedRecording, complete: boolean): void;
  /** False once a newer load or an unmount took over; the loop stops feeding. */
  isCurrent(): boolean;
}

/**
 * Loads a session's files one by one, oldest first, handing the sink the
 * stitched session after each, so playback can start on the first file while
 * the rest download. A file that cannot be fetched, parsed or joined is skipped
 * and counted; when none loads, the first error is thrown.
 */
export async function loadSessionSegments(
  sources: ReadonlyArray<() => Promise<ArrayBuffer>>,
  sink: SegmentSink,
): Promise<{ failed: number }> {
  const parsed: ParsedRecording[] = [];
  let failed = 0;
  let firstError: unknown = null;
  let completeSent = false;

  for (let index = 0; index < sources.length; index++) {
    let recording: ParsedRecording;
    try {
      const next = parseMcrec(await sources[index]());
      recording = stitchRecordings([...parsed, next]);
      parsed.push(next);
    } catch (error) {
      failed++;
      firstError ??= error;
      continue;
    }
    if (!sink.isCurrent()) return { failed };

    const complete = index === sources.length - 1;
    if (parsed.length === 1) {
      await sink.start(recording, complete);
      if (!sink.isCurrent()) return { failed };
    } else {
      sink.extend(recording, complete);
    }
    completeSent = complete;
  }

  if (parsed.length === 0) throw firstError ?? new Error('No recording to load');
  // The last file failed: what did load is the whole session now.
  if (!completeSent && sink.isCurrent()) sink.extend(stitchRecordings(parsed), true);
  return { failed };
}
