/**
 * The recording page when there is nothing to play: a recording the server has
 * not got (an unknown id, a deleted session, an expired or deleted file) is a
 * 404 with no Retry; any other failed read stays the "couldn't load" error.
 * With a recording, the session's events are listed and a row seeks the player.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { RecordingNotFoundError } from '../../services/session-recordings-service';
import type { RecordingDetail } from '../../types/session-recording';
import { RemoteSessionView } from './remote-session-view';
import type { UseRecordingPlayerResult } from './use-recording-player';

const recording = vi.hoisted(() => ({
  data: undefined as RecordingDetail | undefined,
  error: null as Error | null,
  refetch: vi.fn(),
}));
const playback = vi.hoisted<{ state: UseRecordingPlayerResult['state']; currentMs: number; seek: Mock }>(() => ({
  state: 'empty',
  currentMs: 0,
  seek: vi.fn(),
}));
const T0 = Date.parse('2026-10-14T08:00:00.000Z');
const timeline = vi.hoisted(() => ({
  events: [] as { id: string; atMs: number; offsetMs: number | null; title: string; detail: string | null }[],
}));

vi.mock('../../hooks/use-session-recordings', () => {
  const mutation = { mutate: vi.fn(), isPending: false };
  return {
    useSessionRecording: () => ({
      data: recording.data,
      error: recording.error,
      isError: recording.error !== null,
      isPending: recording.error === null && !recording.data,
      isPaused: false,
      refetch: recording.refetch,
    }),
    useDeleteRemoteSession: () => mutation,
    useKeepSessionRecording: () => mutation,
    useReleaseSessionRecording: () => mutation,
    useRecordingStorage: () => ({ data: undefined }),
  };
});
vi.mock('./use-recording-player', () => ({
  useRecordingPlayer: (): UseRecordingPlayerResult => ({
    state: playback.state,
    currentMs: playback.currentMs,
    durationMs: playback.state === 'empty' ? 0 : 60_000,
    speed: 1,
    protocol: playback.state === 'empty' ? null : 2,
    timeline: playback.state === 'empty' ? null : { baseTimeMs: T0, durationMs: 60_000 },
    canvasRef: { current: null },
    terminalHostRef: { current: null },
    loadSegments: vi.fn(),
    togglePlay: vi.fn(),
    seek: playback.seek,
    stepBack: vi.fn(),
    stepForward: vi.fn(),
    setSpeed: vi.fn(),
    cycleSpeed: vi.fn(),
  }),
}));
vi.mock('../../hooks/use-session-events', () => ({
  useSessionEvents: (recordingId: string | null) => (recordingId ? timeline.events : []),
  useReportRecordingPlayed: vi.fn(),
}));
vi.mock('../../hooks/use-remote-access-mock-tools', () => ({ useRemoteAccessMockTools: () => false }));
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitLocalUpdate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/devices/details/remote-session',
  useSearchParams: () => new URLSearchParams(),
}));

// The meta card measures its values for truncation; jsdom has no
// `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<RemoteSessionView recordingId="rec-1" />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  recording.error = null;
  recording.data = undefined;
  playback.state = 'empty';
  playback.currentMs = 0;
  timeline.events = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('RemoteSessionView without a recording', () => {
  it('shows the 404 for a recording the server has not got, with nothing to retry', () => {
    recording.error = new RecordingNotFoundError();
    render();
    expect(container.textContent).toContain('Not Found');
    expect(container.textContent).toContain('Recording not found');
    expect(container.textContent).not.toContain("Couldn't load this recording.");
    expect(Array.from(container.querySelectorAll('button')).map(button => button.textContent)).not.toContain('Retry');
  });

  it('keeps the load error with Retry for any other failed read', () => {
    recording.error = new Error('Relay fetch timed out');
    render();
    expect(container.textContent).toContain("Couldn't load this recording.");
    expect(container.textContent).not.toContain('Recording not found');
  });
});

const RECORDING: RecordingDetail = {
  id: 'session-1',
  deviceId: 'device-1',
  startedAt: '2026-10-14T07:59:57.500Z',
  durationMs: 60_000,
  sizeBytes: 1024,
  protocol: 2,
  recordingState: 'ready',
  live: false,
  kept: false,
  keep: null,
  expiresAt: null,
  recordingId: 'rec-1',
  employee: { name: 'Roman Smith' },
  organization: { name: 'Acme' },
  segments: [],
  chat: [],
};

describe('RemoteSessionView with a recording', () => {
  beforeEach(() => {
    recording.data = RECORDING;
    timeline.events = [
      {
        id: 'input',
        atMs: T0 + 3000,
        offsetMs: 5500,
        title: 'Input enabled',
        detail: 'technician took keyboard and mouse',
      },
      { id: 'shortcut', atMs: T0 + 52_000, offsetMs: 54_500, title: 'Shortcut applied', detail: 'Ctrl + Shift + Esc' },
    ];
  });

  const rows = () => Array.from(container.querySelectorAll<HTMLButtonElement>('ol button'));

  it('lists the events at their place in the video, the one under the playhead highlighted, and seeks to a row', () => {
    playback.state = 'paused';
    playback.currentMs = 52_000;
    render();
    expect(container.textContent).toContain('Session Events');
    expect(rows().map(row => row.textContent)).toEqual([
      '00:03Input enabledtechnician took keyboard and mouse',
      '00:52Shortcut appliedCtrl + Shift + Esc',
    ]);
    expect(rows().map(row => row.getAttribute('aria-current'))).toEqual([null, 'true']);

    act(() => rows()[0].click());
    expect(playback.seek).toHaveBeenCalledWith(3000);
    // The same events mark the track.
    expect(container.querySelector('[aria-label="Input enabled at 00:03"]')).not.toBeNull();
  });

  it('lists the events by the time from the session start while the video is not loaded', () => {
    render();
    expect(rows().map(row => row.textContent?.slice(0, 5))).toEqual(['00:05', '00:54']);
    expect(rows().map(row => row.getAttribute('aria-current'))).toEqual([null, null]);
  });
});
