import {
  REMOTE_SESSION_KEEP_REASON_LABELS,
  type RemoteSessionEvent,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
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
import { type RecordingTimeline, toPlaybackMs } from '@/lib/meshcentral/recording';
import { formatBytes } from './format';

// How the session's timeline reads in the Session Events list and on the
// player's track markers.

/** A timeline row as the list reads it, spread in the recording page's events query. */
const sessionEventFragment = graphql`
  fragment sessionEvents_event on RemoteSessionEvent @inline {
    id
    type
    at
    offsetMs
    actor {
      kind
      name
    }
    label
    byteCount
    toMonitorId
    endReason
    holdReason
  }
`;

/** One row of the Session Events list. */
export interface SessionTimelineEvent {
  id: string;
  /** The server wall clock, ms since epoch - what places the row on the player's track. */
  atMs: number;
  /** Ms from the session start; null for a row before it. */
  offsetMs: number | null;
  title: string;
  detail: string | null;
}

const KEEP_REASONS: Record<RecordingHoldReason, string> = {
  [RecordingHoldReason.CLIENT_DISPUTE]: REMOTE_SESSION_KEEP_REASON_LABELS.CLIENT_DISPUTE,
  [RecordingHoldReason.INTERNAL_REVIEW]: REMOTE_SESSION_KEEP_REASON_LABELS.INTERNAL_REVIEW,
  [RecordingHoldReason.LEGAL_COMPLIANCE]: REMOTE_SESSION_KEEP_REASON_LABELS.LEGAL_OR_COMPLIANCE,
  [RecordingHoldReason.OTHER]: REMOTE_SESSION_KEEP_REASON_LABELS.OTHER,
};

/** Why a session ended, when no person ended it. */
const END_REASONS: Record<RemoteSessionEndReason, string> = {
  [RemoteSessionEndReason.ADMIN]: 'ended by an admin',
  [RemoteSessionEndReason.CLIENT]: 'ended by the end user',
  [RemoteSessionEndReason.TIMEOUT]: 'time limit reached',
  [RemoteSessionEndReason.CONNECTION_LOST]: 'connection lost',
  [RemoteSessionEndReason.NEVER_CONNECTED]: 'never connected',
  [RemoteSessionEndReason.POLICY]: 'ended by policy',
};

/** "by <name>" for a technician's row; END_USER and SYSTEM rows carry no name. */
function byActor(event: SessionEventNode): string | null {
  if (event.actor.kind === RemoteSessionActorKind.END_USER) return 'by the end user';
  return event.actor.name ? `by ${event.actor.name}` : null;
}

function endedDetail(event: SessionEventNode): string | null {
  if (event.actor.kind === RemoteSessionActorKind.END_USER) return 'ended by the end user';
  if (event.actor.kind !== RemoteSessionActorKind.SYSTEM && event.actor.name) return `ended by ${event.actor.name}`;
  return event.endReason ? (END_REASONS[event.endReason as RemoteSessionEndReason] ?? null) : null;
}

function keptDetail(event: SessionEventNode): string | null {
  const reason = event.holdReason ? KEEP_REASONS[event.holdReason as RecordingHoldReason] : null;
  const actor = byActor(event);
  return [reason, actor].filter(Boolean).join(', ') || null;
}

/**
 * The title and detail of a row, worded as the design's ("Input enabled" /
 * "technician took keyboard and mouse"); null for a type the list does not show.
 */
export function describeSessionEvent(event: SessionEventNode): Pick<SessionTimelineEvent, 'title' | 'detail'> | null {
  switch (event.type) {
    case RemoteSessionEventType.STARTED:
      return { title: 'Session started', detail: byActor(event) };
    case RemoteSessionEventType.ENDED:
      return { title: 'Session ended', detail: endedDetail(event) };
    case RemoteSessionEventType.INPUT_ENABLED:
      return { title: 'Input enabled', detail: 'technician took keyboard and mouse' };
    case RemoteSessionEventType.INPUT_DISABLED:
      return { title: 'Input disabled', detail: 'technician released keyboard and mouse' };
    case RemoteSessionEventType.REMOTE_CLIPBOARD_COPIED:
      return {
        title: 'Clipboard copied',
        detail: event.byteCount != null ? `${formatBytes(event.byteCount)} from device` : null,
      };
    case RemoteSessionEventType.REMOTE_CLIPBOARD_PASTED:
      return {
        title: 'Clipboard pasted',
        detail: event.byteCount != null ? `${formatBytes(event.byteCount)} to device` : null,
      };
    case RemoteSessionEventType.SHORTCUT_SENT:
      return { title: 'Shortcut applied', detail: event.label ?? null };
    case RemoteSessionEventType.CTRL_ALT_DEL:
      return { title: 'Shortcut applied', detail: 'Ctrl + Alt + Del' };
    case RemoteSessionEventType.MONITOR_SWITCHED:
      return {
        title: 'Monitor switched',
        detail: event.label ?? (event.toMonitorId != null ? `Display ${event.toMonitorId}` : null),
      };
    case RemoteSessionEventType.RECORDING_KEPT:
      return { title: 'Recording kept', detail: keptDetail(event) };
    case RemoteSessionEventType.RECORDING_RELEASED:
      return { title: 'Recording released', detail: byActor(event) };
    default:
      return null;
  }
}

export function toSessionTimelineEvent(ref: SessionEventRef): SessionTimelineEvent | null {
  const event = readInlineData(sessionEventFragment, ref);
  const text = describeSessionEvent(event);
  if (!text) return null;
  return {
    id: event.id,
    atMs: Date.parse(String(event.at)),
    offsetMs: event.offsetMs != null ? Number(event.offsetMs) : null,
    ...text,
  };
}

/**
 * The rows as the list and the markers show them, at their place in the
 * video: once a recording is loaded, the server time mapped onto the player's
 * timeline (which starts at the first frame and has reconnect gaps cut);
 * before that, the time from the session start the server gives.
 */
export function placeSessionEvents(
  events: readonly SessionTimelineEvent[],
  timeline: RecordingTimeline | null,
): RemoteSessionEvent[] {
  return events.map(({ id, atMs, offsetMs, title, detail }) => ({
    id,
    offsetMs: timeline ? toPlaybackMs(timeline, atMs) : (offsetMs ?? 0),
    title,
    detail,
  }));
}

/** The row the playhead is on: the last one at or before it. */
export function activeSessionEventId(events: readonly RemoteSessionEvent[], currentMs: number): string | null {
  let active: string | null = null;
  for (const event of events) {
    if (event.offsetMs > currentMs) break;
    active = event.id;
  }
  return active;
}
