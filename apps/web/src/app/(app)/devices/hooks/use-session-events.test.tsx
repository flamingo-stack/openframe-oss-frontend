/**
 * The playback report: one call when the page first plays a session, none for
 * replays, pauses or seeks on the same page, another for the next session.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordingPlayerState } from '@/lib/meshcentral/recording';
import { useReportRecordingPlayed } from './use-session-events';

const service = vi.hoisted(() => ({ played: vi.fn() }));

vi.mock('../services/remote-session-events-api-service', () => ({
  fetchSessionEventsPage: vi.fn(),
  recordRecordingPlayed: service.played,
}));

function Probe({ sessionId, state }: { sessionId: string | null; state: RecordingPlayerState }) {
  useReportRecordingPlayed(sessionId, state);
  return null;
}

let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.played.mockReset().mockResolvedValue(true);
  root = createRoot(document.createElement('div'));
});

afterEach(() => {
  act(() => root.unmount());
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
