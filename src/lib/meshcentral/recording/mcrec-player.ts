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
 * Seeking replays from record zero (KVM tiles are incremental - there are no
 * keyframes to jump to), gated on renderer drain per batch; a fresh seek
 * aborts an in-flight one via a generation counter.
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

  /** Rewind to the start of an already-parsed recording. */
  loadParsed(recording: ParsedRecording): void {
    this.stopClock();
    this.recording = recording;
    this.cursor = 0;
    this.setVirtualTime(0);
    this.renderer?.reset();
    this.callbacks.onDuration?.(recording.durationMs);
    this.setState('ready');
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
      let index = 0;
      while (index < agentRecords.length && agentRecords[index].timeMs - baseTimeMs <= target) {
        // Checked on EVERY feed, not only at drain points: a newer seek resets
        // the renderer mid-replay, and even one stale tile fed into the fresh
        // decoder draws into the wrong frame (KVM tiles are incremental).
        if (generation !== this.seekGeneration || this.disposed) return;
        renderer.feed(agentRecords[index].data);
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

      if (target >= recording.durationMs && recording.durationMs > 0) {
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

      const elapsed = (performance.now() - this.anchorRealMs) * this.speed;
      this.setVirtualTime(Math.min(this.anchorVirtualMs + elapsed, this.recording.durationMs));
      this.feedDue();

      if (this.virtualMs >= this.recording.durationMs && this.cursor >= this.recording.agentRecords.length) {
        this.setState('ended');
        return;
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
      renderer.feed(agentRecords[this.cursor].data);
      this.cursor++;
    }
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
