/**
 * Pins the recording player's preview: a loaded recording that has not started
 * shows a centred Play button, which starts playback; once it has played, or
 * when nothing could be loaded, there is no preview.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingPlayer } from './recording-player';
import type { UseRecordingPlayerResult } from './use-recording-player';

function player(state: UseRecordingPlayerResult['state']): UseRecordingPlayerResult {
  return {
    state,
    currentMs: 0,
    durationMs: 105_000,
    speed: 1,
    protocol: 2,
    canvasRef: { current: null },
    terminalHostRef: { current: null },
    loadSegments: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    stepBack: vi.fn(),
    stepForward: vi.fn(),
    setSpeed: vi.fn(),
    cycleSpeed: vi.fn(),
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const playButton = () => container.querySelector<HTMLButtonElement>('button[aria-label="Play recording"]');

describe('RecordingPlayer preview', () => {
  it('shows a Play button over a loaded recording until playback starts', () => {
    const ready = player('ready');
    act(() => root.render(<RecordingPlayer player={ready} unavailableNote={null} />));
    act(() => playButton()?.click());
    expect(ready.togglePlay).toHaveBeenCalledTimes(1);

    act(() => root.render(<RecordingPlayer player={player('paused')} unavailableNote={null} />));
    expect(playButton()).toBeNull();
  });

  it('shows why there is nothing to play instead of a preview when nothing loaded', () => {
    act(() => root.render(<RecordingPlayer player={player('empty')} unavailableNote="This recording was deleted" />));
    expect(playButton()).toBeNull();
    expect(container.textContent).toContain('Session recording unavailable');
    expect(container.textContent).toContain('This recording was deleted');
  });
});
