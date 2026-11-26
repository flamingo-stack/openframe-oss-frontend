import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type DecodedTile, TileDrawQueue } from './meshcentral-tile-draw-queue';

describe('TileDrawQueue', () => {
  let frames: FrameRequestCallback[];
  let closed: number;

  class CountedImageBitmap {
    close() {
      closed += 1;
    }
  }

  function tile(x: number): DecodedTile {
    return { x, y: 0, bitmap: new CountedImageBitmap() as unknown as ImageBitmap };
  }

  beforeEach(() => {
    frames = [];
    closed = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('ImageBitmap', CountedImageBitmap);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('draws on the timer when no animation frame comes, and releases each drawn tile', () => {
    const drawn: number[] = [];
    const queue = new TileDrawQueue(() => t => drawn.push(t.x));
    queue.push(tile(0));
    queue.push(tile(64));
    expect(frames).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(drawn).toEqual([0, 64]);
    expect(closed).toBe(2);
    expect(queue.size).toBe(0);
  });

  it('drops the queued tiles when there is nothing to draw on', () => {
    const queue = new TileDrawQueue(() => null);
    queue.push(tile(0));
    frames[0](0);
    expect(closed).toBe(1);
    expect(queue.size).toBe(0);
  });

  it('schedules a fresh drain for a tile pushed right after clear', () => {
    const drawn: number[] = [];
    const queue = new TileDrawQueue(() => t => drawn.push(t.x));
    queue.push(tile(0));
    queue.clear();
    expect(closed).toBe(1);
    queue.push(tile(64));
    expect(frames).toHaveLength(2);
    frames[1](0);
    expect(drawn).toEqual([64]);
  });
});
