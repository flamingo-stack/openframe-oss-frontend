/**
 * The recording page when there is nothing to play: a recording the server has
 * not got (an unknown id, a deleted session, an expired or deleted file) is a
 * 404 with no Retry; any other failed read stays the "couldn't load" error.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingNotFoundError } from '../../services/session-recordings-service';
import { RemoteSessionView } from './remote-session-view';
import type { UseRecordingPlayerResult } from './use-recording-player';

const recording = vi.hoisted(() => ({ error: null as Error | null, refetch: vi.fn() }));

vi.mock('../../hooks/use-session-recordings', () => {
  const mutation = { mutate: vi.fn(), isPending: false };
  return {
    useSessionRecording: () => ({
      data: undefined,
      error: recording.error,
      isError: recording.error !== null,
      isPending: recording.error === null,
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
    state: 'empty',
    currentMs: 0,
    durationMs: 0,
    speed: 1,
    protocol: null,
    canvasRef: { current: null },
    terminalHostRef: { current: null },
    loadSegments: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    stepBack: vi.fn(),
    stepForward: vi.fn(),
    setSpeed: vi.fn(),
    cycleSpeed: vi.fn(),
  }),
}));
vi.mock('../../hooks/use-remote-access-mock-tools', () => ({ useRemoteAccessMockTools: () => false }));
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitLocalUpdate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/devices/details/remote-session',
  useSearchParams: () => new URLSearchParams(),
}));

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<RemoteSessionView recordingId="rec-1" />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  recording.error = null;
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
