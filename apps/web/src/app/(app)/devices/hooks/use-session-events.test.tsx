/**
 * The Session Events rows across pages, and the playback report: one call when
 * the page first plays a session, none for replays, pauses or seeks on the same
 * page, another for the next session.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteSessionEventType } from '@/generated/schema-enums';
import type { RecordingPlayerState } from '@/lib/meshcentral/recording';
import type { SessionTimelineEvent } from '../components/remote-sessions/session-events';
import type { SessionEventsPage } from '../services/remote-session-events-api-service';
import { useReportRecordingPlayed, useSessionEvents } from './use-session-events';

const service = vi.hoisted(() => ({ played: vi.fn(), page: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
vi.mock('../services/remote-session-events-api-service', () => ({
  fetchSessionEventsPage: service.page,
  recordRecordingPlayed: service.played,
}));

function Probe({ sessionId, state }: { sessionId: string | null; state: RecordingPlayerState }) {
  useReportRecordingPlayed(sessionId, state);
  return null;
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.played.mockReset().mockResolvedValue(true);
  service.page.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

function timelineRow(type: RemoteSessionEventType, title: string, detail: string | null): SessionTimelineEvent {
  return { id: `row-${type}`, type, atMs: 0, offsetMs: 0, title, detail };
}

describe('useSessionEvents', () => {
  /** Draws each row's detail, so the test reads what the list would show. */
  function EventsProbe() {
    const events = useSessionEvents('recording-1');
    return (
      <ul>
        {events.map(({ id, detail }) => (
          <li key={id}>{detail}</li>
        ))}
      </ul>
    );
  }

  const details = () => [...container.querySelectorAll('li')].map(item => item.textContent);

  it('names on "Session ended" everyone still watching, whichever page their leave came on', async () => {
    const first: SessionEventsPage = {
      events: [timelineRow(RemoteSessionEventType.STARTED, 'Session started', 'by Roman Smith')],
      viewersAtEnd: [{ userId: 'user-anna', name: 'Anna Lee' }],
      nextCursor: 'cursor-2',
    };
    const second: SessionEventsPage = {
      events: [timelineRow(RemoteSessionEventType.ENDED, 'Session ended', 'ended by Roman Smith')],
      viewersAtEnd: [{ userId: 'user-bob', name: 'Bob Moss' }],
      nextCursor: null,
    };
    service.page.mockImplementation((_id: string, after: string | null) => Promise.resolve(after ? second : first));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <EventsProbe />
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(() => expect(details()).toHaveLength(2));

    expect(details()).toEqual(['by Roman Smith', 'ended by Roman Smith · watching: Anna Lee, Bob Moss']);
    expect(service.page.mock.calls).toEqual([
      ['recording-1', null],
      ['recording-1', 'cursor-2'],
    ]);
  });
});

describe('useReportRecordingPlayed', () => {
  it('reports the first playback of a session once', () => {
    const states: RecordingPlayerState[] = ['ready', 'playing', 'paused', 'seeking', 'playing', 'ended'];
    for (const state of states) act(() => root.render(<Probe sessionId="session-1" state={state} />));
    expect(service.played.mock.calls).toEqual([['session-1']]);
  });

  it('reports nothing until it plays, and the next session again', () => {
    act(() => root.render(<Probe sessionId="session-1" state="ready" />));
    act(() => root.render(<Probe sessionId={null} state="playing" />));
    expect(service.played).not.toHaveBeenCalled();
    act(() => root.render(<Probe sessionId="session-1" state="playing" />));
    act(() => root.render(<Probe sessionId="session-2" state="playing" />));
    expect(service.played.mock.calls).toEqual([['session-1'], ['session-2']]);
  });

  it('swallows a failed report', async () => {
    service.played.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    act(() => root.render(<Probe sessionId="session-1" state="playing" />));
    await act(() => Promise.resolve());
    expect(service.played).toHaveBeenCalledTimes(1);
  });
});
