import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McrecPlayerCallbacks, RecordingPlayerState } from '@/lib/meshcentral/recording';
import { type UseRecordingPlayerResult, useRecordingPlayer } from './use-recording-player';

const player = vi.hoisted(() => ({ callbacks: {} as McrecPlayerCallbacks, cancelWait: vi.fn() }));

vi.mock('@/lib/meshcentral/recording', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  McrecPlayer: class {
    cancelWait = player.cancelWait;
    constructor(callbacks: McrecPlayerCallbacks) {
      player.callbacks = callbacks;
    }
    dispose() {}
  },
}));

let container: HTMLDivElement;
let root: Root;
let result: UseRecordingPlayerResult | null = null;

function Probe() {
  const value = useRecordingPlayer();
  useEffect(() => {
    result = value;
  });
  return null;
}

function report(state: RecordingPlayerState) {
  act(() => player.callbacks.onState?.(state));
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  result = null;
});

describe('useRecordingPlayer', () => {
  it('shows a seek as seeking only once it has run 150 ms', () => {
    report('paused');
    report('seeking');
    expect(result?.state).toBe('paused');
    wait(149);
    expect(result?.state).toBe('paused');
    wait(1);
    expect(result?.state).toBe('seeking');
    report('paused');
    expect(result?.state).toBe('paused');
  });

  it('shows waiting for a file at once, and keeps it through the first 150 ms of the seek that follows', () => {
    report('paused');
    report('seeking');
    report('waiting');
    expect(result?.state).toBe('waiting');
    report('seeking');
    wait(100);
    expect(result?.state).toBe('waiting');
    report('paused');
    expect(result?.state).toBe('paused');
  });

  it('drops a seek waiting for its file when a new load starts', async () => {
    player.cancelWait.mockClear();
    await expect(result?.loadSegments([])).rejects.toThrow();
    expect(player.cancelWait).toHaveBeenCalledOnce();
  });

  it('never shows a seek that lands sooner', () => {
    report('playing');
    report('seeking');
    wait(100);
    report('playing');
    wait(500);
    expect(result?.state).toBe('playing');
  });
});
