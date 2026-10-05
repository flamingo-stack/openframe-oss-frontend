import { parseMcrec } from './mcrec-parser';
import type { ParsedRecording, RecordingPlaybackSpeed, RecordingPlayerState, RecordingRenderer } from './mcrec-types';

export interface McrecPlayerCallbacks {
  onTime?: (currentMs: number) => void;
  onDuration?: (durationMs: number) => void;
  onState?: (state: RecordingPlayerState) => void;
}

const STEP_MS = 10_000;

/**
 * Drain the decode pipeline every N fed records during a seek replay. The
 * desktop decoder drops the oldest queued tile past 300 entries, so the batch
 * must stay well under that; 100 leaves 3x headroom and yields the event loop
 * between batches so a long replay cannot freeze the page.
 */
const SEEK_DRAIN_BATCH = 100;

/**
 * Offline player for MeshCentral `.mcrec` recordings. Protocol-agnostic: the
 * renderer adapter (canvas/KVM or xterm) consumes payloads, the player owns
 * the timeline - a rAF clock advances a virtual time and feeds every
 * agent-record whose timestamp it has passed. The renderer draws as fast as it
 * is fed, so pacing the FEED is what produces real-time playback.
 *
 * Seeking replays from the nearest restart point before the target (KVM tiles
 * are incremental, so the only places a fresh decoder can start are the
 * starts of the session's files - record zero for a single file), gated on
 * renderer drain per batch; a fresh seek aborts an in-flight one via a
 * generation counter.
 *
 * Each later file starts from a fresh renderer too: a tunnel that dropped
 * mid-frame leaves a torn frame at the end of its file, and decoding the next
 * file's opening on top of it would desync the stream.
 *
 * A session's files can arrive one by one: `loadParsed(..., { complete: false })`
 * starts on what is there, `extend` appends the rest. Until the last one lands,
 * reaching the end of the loaded part waits instead of ending.
 */
export class McrecPlayer {
  private recording: ParsedRecording | null = null;
  private renderer: RecordingRenderer | null = null;

  private playerState: RecordingPlayerState = 'empty';
  private speed: RecordingPlaybackSpeed = 1;

  /** Index of the next agent-record to feed. */
  private cursor = 0;
  /** Virtual playhead position (ms from recording start). */
  private virtualMs = 0;
  private anchorVirtualMs = 0;
  private anchorRealMs = 0;

  /** False while more of the session is still being loaded. */
  private complete = true;
  /** `restartIndices` past the first: where a later file begins and the renderer starts over. */
  private fileStarts = new Set<number>();

  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private seekGeneration = 0;
  private disposed = false;

  constructor(private readonly callbacks: McrecPlayerCallbacks = {}) {}

  get state(): RecordingPlayerState {
    return this.playerState;
  }

  get currentMs(): number {
    return this.virtualMs;
  }

  get durationMs(): number {
    return this.recording?.durationMs ?? 0;
  }

  get currentSpeed(): RecordingPlaybackSpeed {
    return this.speed;
  }

  attachRenderer(renderer: RecordingRenderer): void {
    this.renderer = renderer;
  }

  /** Parse a buffer and rewind to the start. Requires an attached renderer. */
  load(buffer: ArrayBuffer): ParsedRecording {
    const recording = parseMcrec(buffer);
    this.loadParsed(recording);
    return recording;
  }

  /**
   * Rewind to the start of an already-parsed recording. `complete: false` when
   * more of the session will follow through {@link extend}.
   */
  loadParsed(recording: ParsedRecording, { complete = true }: { complete?: boolean } = {}): void {
    this.stopClock();
    this.recording = recording;
    this.complete = complete;
    this.fileStarts = laterFileStarts(recording);
    this.cursor = 0;
    this.setVirtualTime(0);
    this.renderer?.reset();
    this.callbacks.onDuration?.(recording.durationMs);
    this.setState('ready');
  }

  /**
   * Swap in a longer version of the loaded recording - the same records in
   * front, more after them - without touching the playhead or what is on
   * screen. `complete` says whether this is the whole session.
   */
  extend(recording: ParsedRecording, complete: boolean): void {
    if (!this.recording || this.disposed) return;
    this.recording = recording;
    this.complete = complete;
    this.fileStarts = laterFileStarts(recording);
    this.callbacks.onDuration?.(recording.durationMs);
  }

  play(): void {
    if (!this.recording || this.playerState === 'seeking' || this.disposed) return;
    if (this.playerState === 'ended') {
      // Replaying from the end restarts from zero, like any video player.
      void this.seek(0).then(() => this.play());
      return;
    }
    this.anchorVirtualMs = this.virtualMs;
    this.anchorRealMs = performance.now();
    this.setState('playing');
    this.startClock();
  }

  pause(): void {
    if (this.playerState !== 'playing') return;
    this.stopClock();
    this.setState('paused');
  }

  setSpeed(speed: RecordingPlaybackSpeed): void {
    // Re-anchor so the already-elapsed stretch keeps its old speed.
    this.anchorVirtualMs = this.virtualMs;
    this.anchorRealMs = performance.now();
    this.speed = speed;
  }

  stepBack(): Promise<void> {
    return this.seek(this.virtualMs - STEP_MS);
  }

  stepForward(): Promise<void> {
    return this.seek(this.virtualMs + STEP_MS);
  }

  /**
   * Jump to `targetMs` by resetting the renderer and replaying every agent
   * record up to the target as fast as the decoder drains. Concurrent seeks
   * coalesce: a newer call bumps the generation and the older loop exits.
   */
  async seek(targetMs: number): Promise<void> {
    const recording = this.recording;
    const renderer = this.renderer;
    if (!recording || !renderer || this.disposed) return;

    const target = Math.min(Math.max(0, targetMs), recording.durationMs);
    const wasPlaying = this.playerState === 'playing';
    const generation = ++this.seekGeneration;

    this.stopClock();
    this.setState('seeking');
    try {
      await renderer.reset();
      if (generation !== this.seekGeneration || this.disposed) return;

      const { agentRecords, baseTimeMs } = recording;
      let index = restartIndexBefore(recording, target);
      while (index < agentRecords.length && agentRecords[index].timeMs - baseTimeMs <= target) {
        // Checked on EVERY feed, not only at drain points: a newer seek resets
        // the renderer mid-replay, and even one stale tile fed into the fresh
        // decoder draws into the wrong frame (KVM tiles are incremental).
        if (generation !== this.seekGeneration || this.disposed) return;
        this.feedRecord(renderer, index);
        index++;
        if (index % SEEK_DRAIN_BATCH === 0) {
          await renderer.waitForIdle();
          if (generation !== this.seekGeneration || this.disposed) return;
        }
      }
      await renderer.waitForIdle();
      if (generation !== this.seekGeneration || this.disposed) return;

      this.cursor = index;
      this.setVirtualTime(target);

      if (this.complete && target >= recording.durationMs && recording.durationMs > 0) {
        this.setState('ended');
        return;
      }
      if (wasPlaying) {
        this.anchorVirtualMs = target;
        this.anchorRealMs = performance.now();
        this.setState('playing');
        this.startClock();
      } else {
        this.setState('paused');
      }
    } catch (error) {
      // A failed CURRENT seek must not leave the player wedged in 'seeking' -
      // land paused, and at ZERO: the renderer was reset before the failure, so
      // the last pre-seek position no longer matches what is on screen. A stale
      // seek (newer one took over) leaves state ownership to that newer call.
      if (generation === this.seekGeneration && !this.disposed) {
        this.cursor = 0;
        this.setVirtualTime(0);
        this.setState('paused');
      }
      throw error;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.seekGeneration++;
    this.stopClock();
    this.renderer?.dispose();
    this.renderer = null;
    this.recording = null;
    this.setState('empty');
  }

  /**
   * The clock ticks on a timer, not requestAnimationFrame: rAF stops entirely
   * in hidden/occluded tabs, which would freeze playback there. Painting is
   * still vsynced - the desktop decoder coalesces draws through its own rAF -
   * so the tick only needs to be frequent enough to feed records on time.
   */
  private static readonly TICK_MS = 33;

  private startClock(): void {
    if (this.tickTimer !== null) return;
    const tick = () => {
      this.tickTimer = null;
      if (this.playerState !== 'playing' || !this.recording) return;

      const now = performance.now();
      const elapsed = (now - this.anchorRealMs) * this.speed;
      this.setVirtualTime(Math.min(this.anchorVirtualMs + elapsed, this.recording.durationMs));
      this.feedDue();

      const atEnd = this.virtualMs >= this.recording.durationMs && this.cursor >= this.recording.agentRecords.length;
      if (atEnd && this.complete) {
        this.setState('ended');
        return;
      }
      if (atEnd) {
        // Waiting for the next file: hold the clock here, so playback resumes
        // from this point instead of jumping by the time spent waiting.
        this.anchorVirtualMs = this.virtualMs;
        this.anchorRealMs = now;
      }
      this.tickTimer = setTimeout(tick, McrecPlayer.TICK_MS);
    };
    this.tickTimer = setTimeout(tick, McrecPlayer.TICK_MS);
  }

  private stopClock(): void {
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private feedDue(): void {
    const recording = this.recording;
    const renderer = this.renderer;
    if (!recording || !renderer) return;
    const { agentRecords, baseTimeMs } = recording;
    while (this.cursor < agentRecords.length && agentRecords[this.cursor].timeMs - baseTimeMs <= this.virtualMs) {
      this.feedRecord(renderer, this.cursor);
      this.cursor++;
    }
  }

  /** Feeds one agent record, starting the renderer over first where a later file of the session begins. */
  private feedRecord(renderer: RecordingRenderer, index: number): void {
    const recording = this.recording;
    if (!recording) return;
    if (this.fileStarts.has(index)) void renderer.reset();
    renderer.feed(recording.agentRecords[index].data);
  }

  private setVirtualTime(ms: number): void {
    this.virtualMs = ms;
    this.callbacks.onTime?.(ms);
  }

  private setState(state: RecordingPlayerState): void {
    if (this.playerState === state) return;
    this.playerState = state;
    this.callbacks.onState?.(state);
  }
}

/** The last restart point at or before `targetMs` - where a seek to it has to start replaying. */
function restartIndexBefore(recording: ParsedRecording, targetMs: number): number {
  const { agentRecords, baseTimeMs } = recording;
  let start = 0;
  for (const index of recording.restartIndices ?? [0]) {
    const record = agentRecords[index];
    if (!record || record.timeMs - baseTimeMs > targetMs) break;
    start = index;
  }
  return start;
}

function laterFileStarts(recording: ParsedRecording): Set<number> {
  return new Set((recording.restartIndices ?? [0]).filter(index => index > 0));
}
