/**
 * How the session's timeline reads on the recording page: each listed type
 * worded as the design words it, and every row placed where the player shows
 * that moment, so the list, the marks and the playhead agree.
 */
import { describe, expect, it, vi } from 'vitest';
import type {
  sessionEvents_event$data as SessionEventNode,
  sessionEvents_event$key as SessionEventRef,
} from '@/__generated__/sessionEvents_event.graphql';
import {
  RecordingHoldReason,
  RemoteSessionActorKind,
  RemoteSessionEndReason,
  RemoteSessionEventType,
} from '@/generated/schema-enums';
import {
  activeSessionEventId,
  describeSessionEvent,
  placeSessionEvents,
  type SessionTimelineEvent,
  toSessionTimelineEvent,
} from './session-events';

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const technician = { kind: RemoteSessionActorKind.TECHNICIAN, name: 'Roman Smith' };

function node(type: RemoteSessionEventType, fields: Partial<SessionEventNode> = {}): SessionEventNode {
  return {
    id: `row-${type}`,
    type,
    at: '2026-10-14T08:00:26.400Z',
    offsetMs: 29_875,
    actor: technician,
    label: null,
    byteCount: null,
    toMonitorId: null,
    endReason: null,
    holdReason: null,
    ...fields,
  } as SessionEventNode;
}

/** The test reads the row as is; the page reads it through the fragment. */
const asRef = (event: SessionEventNode) => event as unknown as SessionEventRef;

describe('describeSessionEvent', () => {
  it('words the console actions as the design does', () => {
    expect(describeSessionEvent(node(RemoteSessionEventType.INPUT_ENABLED))).toEqual({
      title: 'Input enabled',
      detail: 'technician took keyboard and mouse',
    });
    expect(describeSessionEvent(node(RemoteSessionEventType.SHORTCUT_SENT, { label: 'Ctrl + Shift + Esc' }))).toEqual({
      title: 'Shortcut applied',
      detail: 'Ctrl + Shift + Esc',
    });
    expect(describeSessionEvent(node(RemoteSessionEventType.CTRL_ALT_DEL))?.detail).toBe('Ctrl + Alt + Del');
    expect(describeSessionEvent(node(RemoteSessionEventType.REMOTE_CLIPBOARD_COPIED, { byteCount: 1229 }))).toEqual({
      title: 'Clipboard copied',
      detail: '1.2 KB from device',
    });
    expect(describeSessionEvent(node(RemoteSessionEventType.MONITOR_SWITCHED, { toMonitorId: 2 }))?.detail).toBe(
      'Display 2',
    );
  });

  it('says who ended the session, or why when nobody did', () => {
    const ended = (fields: Partial<SessionEventNode>) =>
      describeSessionEvent(node(RemoteSessionEventType.ENDED, fields))?.detail;
    expect(ended({})).toBe('ended by Roman Smith');
    expect(ended({ actor: { kind: RemoteSessionActorKind.END_USER, name: null } })).toBe('ended by the end user');
    expect(
      ended({ actor: { kind: RemoteSessionActorKind.SYSTEM, name: null }, endReason: RemoteSessionEndReason.TIMEOUT }),
    ).toBe('time limit reached');
  });

  it('names the reason and the technician of a Keep', () => {
    expect(
      describeSessionEvent(
        node(RemoteSessionEventType.RECORDING_KEPT, { holdReason: RecordingHoldReason.CLIENT_DISPUTE }),
      ),
    ).toEqual({ title: 'Recording kept', detail: 'Client dispute, by Roman Smith' });
  });

  it('leaves out the rows the page does not list', () => {
    expect(toSessionTimelineEvent(asRef(node(RemoteSessionEventType.CHAT_MESSAGE)))).toBeNull();
    expect(toSessionTimelineEvent(asRef(node(RemoteSessionEventType.REMOTE_RECORDING_PLAYED)))).toBeNull();
  });
});

const T0 = Date.parse('2026-10-14T08:00:00.000Z');

function row(id: string, atMs: number, offsetMs: number): SessionTimelineEvent {
  return { id, atMs, offsetMs, title: id, detail: null };
}

describe('placeSessionEvents', () => {
  const rows = [row('started', T0 - 2500, 0), row('input', T0 + 30_000, 32_500), row('kept', T0 + 900_000, 902_500)];

  it('places the rows on the player timeline once a recording is loaded, the late ones pinned to its end', () => {
    // The video starts 2.5 s after the session, at its first frame.
    const placed = placeSessionEvents(rows, { baseTimeMs: T0, durationMs: 120_000 });
    expect(placed.map(event => event.offsetMs)).toEqual([0, 30_000, 120_000]);
  });

  it('shows the time from the session start until a recording is loaded', () => {
    expect(placeSessionEvents(rows, null).map(event => event.offsetMs)).toEqual([0, 32_500, 902_500]);
  });
});

describe('activeSessionEventId', () => {
  const placed = placeSessionEvents([row('a', T0 + 3000, 0), row('b', T0 + 7000, 0)], {
    baseTimeMs: T0,
    durationMs: 60_000,
  });

  it('is the last row at or before the playhead, none before the first', () => {
    expect(activeSessionEventId(placed, 1000)).toBeNull();
    expect(activeSessionEventId(placed, 3000)).toBe('a');
    expect(activeSessionEventId(placed, 52_000)).toBe('b');
  });
});
