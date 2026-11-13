/**
 * The recording page when there is nothing to play: a recording the server has
 * not got (an unknown id, a deleted session, an expired or deleted file) is a
 * 404 with no Retry; any other failed read stays the "couldn't load" error.
 * With a recording, the session's events are listed and a row seeks the player,
 * Assign Ticket is offered, and the linked tickets are listed when there are any.
 * Fullscreen is the player's own element, never the document.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { RecordingNotFoundError } from '../../services/session-recordings-service';
import type { RecordingDetail } from '../../types/session-recording';
import type { RecordingTicket } from './recording-tickets';
import { RemoteSessionView } from './remote-session-view';
import type { UseRecordingPlayerResult } from './use-recording-player';

const recording = vi.hoisted(() => ({
  data: undefined as RecordingDetail | undefined,
  error: null as Error | null,
  refetch: vi.fn(),
}));
const playback = vi.hoisted<{
  state: UseRecordingPlayerResult['state'];
  currentMs: number;
  seek: Mock;
  seekToTime: Mock;
}>(() => ({
  state: 'empty',
  currentMs: 0,
  seek: vi.fn(),
  seekToTime: vi.fn(),
}));
const linked = vi.hoisted(() => ({ tickets: [] as RecordingTicket[] }));
// The app's one table flag (`data-table-grid`), as the real hook answers it.
const tableFlag = vi.hoisted(() => ({ gate: 'off' as 'loading' | 'on' | 'off' }));
vi.mock('@/app/hooks/use-table-layout', () => ({
  useTableGridGate: () => tableFlag.gate,
  tableLayoutFor: (gate: string) => (gate === 'on' ? 'grid' : 'cards'),
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
    seekToTime: playback.seekToTime,
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
vi.mock('../../hooks/use-recording-tickets', () => {
  const mutation = { mutate: vi.fn(), isPending: false };
  return {
    useRecordingTickets: (recordingId: string | null) => ({ data: recordingId ? linked.tickets : undefined }),
    useAssignRecordingTickets: () => mutation,
    useUnassignRecordingTicket: () => mutation,
  };
});
vi.mock('@/app/(app)/tickets/hooks/use-ticket-options', () => ({
  useTicketSearchOptions: () => ({ options: [], isLoading: false }),
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
  linked.tickets = [];
  tableFlag.gate = 'off';
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
  technicianId: 'tech-roman',
  organization: { name: 'Acme' },
  segments: [],
  chat: [],
};

const TICKET: RecordingTicket = {
  id: 't-1',
  ticketNumber: 3891,
  title: 'Page not found error',
  statusName: 'TODO',
  statusKind: 'CUSTOM',
  statusColor: '#2890FA',
  assignedName: 'Roman Smith',
  assignedAvatarUrl: null,
  createdAt: null,
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

    // By the server time: the player places it, and waits for its file if that is still downloading.
    act(() => rows()[0].click());
    expect(playback.seekToTime).toHaveBeenCalledWith(T0 + 3000);
    // The same events mark the track.
    expect(container.querySelector('[aria-label="Input enabled at 00:03"]')).not.toBeNull();
  });

  it('lists the events by the time from the session start while the video is not loaded', () => {
    render();
    expect(rows().map(row => row.textContent?.slice(0, 5))).toEqual(['00:05', '00:54']);
    expect(rows().map(row => row.getAttribute('aria-current'))).toEqual([null, null]);
  });
});

describe('RemoteSessionView fullscreen', () => {
  // jsdom has no Fullscreen API: a stand-in that, like a browser, reports the element and fires the change.
  let fullscreenElement: Element | null = null;
  const setFullscreenElement = (element: Element | null) => {
    fullscreenElement = element;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  };
  const requestFullscreen = vi.fn(function (this: HTMLElement) {
    return setFullscreenElement(this);
  });
  const exitFullscreen = vi.fn(() => setFullscreenElement(null));

  beforeEach(() => {
    // The page around the player in full: the chat column beside it, the events and the linked tickets under it.
    recording.data = {
      ...RECORDING,
      chat: [
        { id: 'm-1', author: 'Roman Smith', fromTechnician: false, sentAt: '2026-10-14T08:00:10.000Z', body: 'Hi' },
      ],
    };
    timeline.events = [{ id: 'input', atMs: T0 + 3000, offsetMs: 5500, title: 'Input enabled', detail: null }];
    linked.tickets = [TICKET];
    playback.state = 'paused';
    fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'fullscreenElement');
    Reflect.deleteProperty(document, 'exitFullscreen');
    Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
  });

  const buttonByLabel = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  it('fullscreens the player itself, screen and controls, and follows the browser out of it', () => {
    render();
    const sections = [
      'Remote Session Recording',
      'Video Session Recording',
      'Session Chat',
      'Session Events',
      'Assigned Tickets',
    ];
    for (const section of sections) expect(container.textContent).toContain(section);
    const enter = buttonByLabel('Enter fullscreen');
    expect(enter).not.toBeNull();
    const canvas = container.querySelector('canvas');
    // The smallest box holding the screen and its controls: not the page, nor a wrapper around the player.
    let player = canvas?.parentElement ?? null;
    while (player && !player.contains(enter)) player = player.parentElement;
    expect(player).not.toBeNull();

    act(() => enter?.click());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen.mock.contexts[0]).toBe(player);
    // The page steps aside around the same nodes: a remounted player would drop the browser out of fullscreen.
    for (const section of sections) expect(container.textContent).not.toContain(section);
    expect(player?.isConnected).toBe(true);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(player?.contains(buttonByLabel('Exit fullscreen'))).toBe(true);

    act(() => buttonByLabel('Exit fullscreen')?.click());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    for (const section of sections) expect(container.textContent).toContain(section);
    expect(player?.isConnected).toBe(true);
    expect(container.querySelector('canvas')).toBe(canvas);

    // Esc or the browser's own controls: no exit call from the page, only the change.
    act(() => buttonByLabel('Enter fullscreen')?.click());
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
    expect(buttonByLabel('Exit fullscreen')).not.toBeNull();
    act(() => void setFullscreenElement(null));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(buttonByLabel('Enter fullscreen')).not.toBeNull();
  });
});

describe('RemoteSessionView tickets', () => {
  beforeEach(() => {
    recording.data = RECORDING;
  });

  const buttonLabels = () => Array.from(container.querySelectorAll('button')).map(button => button.textContent);

  it('offers Assign Ticket and leaves the Assigned Tickets section out while none is linked', () => {
    render();
    expect(buttonLabels()).toContain('Assign Ticket');
    expect(container.textContent).not.toContain('Assigned Tickets');
  });

  it('lists the linked tickets', () => {
    linked.tickets = [TICKET];
    render();
    expect(container.textContent).toContain('Assigned Tickets');
    expect(container.textContent).toContain('Page not found error');
  });

  it('lists them on card rows while the table flag is off, and in the grid table while it is on', () => {
    linked.tickets = [TICKET];
    render();
    expect(container.querySelector('[data-grid-root]')).toBeNull();

    tableFlag.gate = 'on';
    render();
    expect(container.textContent).toContain('Page not found error');
    expect(container.querySelector('[data-grid-root]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Table settings"]')).not.toBeNull();
  });

  it('holds the section back while the table flag is read, so its table never swaps layouts', () => {
    linked.tickets = [TICKET];
    tableFlag.gate = 'loading';
    render();
    expect(container.textContent).not.toContain('Assigned Tickets');
    expect(container.querySelector('[data-grid-root]')).toBeNull();
  });
});
