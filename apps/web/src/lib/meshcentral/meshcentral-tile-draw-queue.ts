/** A remote screen tile, decoded and waiting for the canvas. `url` is set when it was decoded through an `<img>`. */
export interface DecodedTile {
  x: number;
  y: number;
  bitmap: ImageBitmap | HTMLImageElement;
  url?: string;
}

/** Draws one tile; a throw is one lost frame, which the next tile repaints over. */
export type TileDrawer = (tile: DecodedTile) => void;

/**
 * How long a scheduled draw waits for an animation frame before a timer drains the queue instead.
 * A visible page draws on the frame (~16 ms) and cancels the timer; a hidden one gets no frames and
 * drains on this timer (which the browser may stretch to a second or more while hidden).
 */
const DRAW_TIMER_FALLBACK_MS = 100;

/** Releases a tile that is drawn or dropped: closes its ImageBitmap and revokes its object URL. */
function releaseTile(tile: DecodedTile) {
  // Only ImageBitmap has `close`; an HTMLImageElement is collected normally.
  if (tile.bitmap instanceof ImageBitmap) {
    try {
      tile.bitmap.close();
    } catch {
      // Releasing a bitmap is a hint to the GC; a browser that refuses it just collects later.
    }
  }
  if (tile.url) {
    try {
      URL.revokeObjectURL(tile.url);
    } catch {
      // Same for the object URL: failing to revoke leaks one blob until the tab closes, which is not worth interrupting the draw loop for.
    }
  }
}

/**
 * The tiles decoded but not drawn yet. Each push schedules one drain: on the next animation frame,
 * or on a timer, whichever comes first, and the other is cancelled. A hidden page (the desktop
 * window hidden or in the tray, a background tab) gets no animation frames at all, so with rAF
 * alone every tile the agent keeps sending stayed decoded in memory until the window was shown
 * again: tens of MB a minute with a busy remote screen. The stream keeps running while hidden,
 * since the session recording needs what happens on the device then; only the drain moves to the
 * timer.
 */
export class TileDrawQueue {
  private tiles: DecodedTile[] = [];
  private scheduled = false;
  /** The pending drain's animation frame and fallback timer: whichever fires first cancels the other. */
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** `drawer` is read at each drain: null when there is nothing to draw on, and the queued tiles are then dropped. */
  constructor(private readonly drawer: () => TileDrawer | null) {}

  get size(): number {
    return this.tiles.length;
  }

  push(tile: DecodedTile) {
    this.tiles.push(tile);
    this.schedule();
  }

  /** Cancels the pending drain and drops every queued tile without drawing it, releasing each one. */
  clear() {
    this.cancel();
    this.release();
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    const drain = () => {
      this.cancel();
      this.drain();
    };
    this.frame = requestAnimationFrame(drain);
    this.timer = setTimeout(drain, DRAW_TIMER_FALLBACK_MS);
  }

  private cancel() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    this.scheduled = false;
  }

  private drain() {
    const draw = this.drawer();
    if (!draw) {
      this.release();
      return;
    }
    for (;;) {
      const tile = this.tiles.shift();
      if (!tile) break;
      try {
        draw(tile);
      } catch {
        // A frame that fails to draw (a bitmap the GPU rejected, a canvas detached mid-teardown) is one lost frame in a video stream — the next one repaints over it.
      }
      releaseTile(tile);
    }
  }

  private release() {
    const queued = this.tiles;
    this.tiles = [];
    for (const tile of queued) releaseTile(tile);
  }
}
