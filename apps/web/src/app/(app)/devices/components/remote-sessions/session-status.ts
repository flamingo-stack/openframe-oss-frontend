import { routes } from '@/lib/routes';
import type { RecordingSummary } from '../../types/session-recording';

// What a Remote Sessions row may do and how it reads, from its recording's
// state. Shared by the device tab and the tenant-wide sessions page, so the
// two lists never disagree about which rows open or delete.

type SessionRow = Pick<RecordingSummary, 'recordingState' | 'live' | 'kept' | 'expiresAt' | 'recordingId'>;

/** Watch live is on for the lists: a running session reads LIVE. */
export interface LiveRows {
  /** The signed-in technician. */
  userId: string | null;
}

/** The row reads LIVE: Watch live is on (`liveRows` set) and the session is still running. */
export function isLiveRow(row: Pick<RecordingSummary, 'live'>, liveRows: LiveRows | null): liveRows is LiveRows {
  return liveRows !== null && row.live;
}

/**
 * The page a row opens. A finished session opens its recording, when it has one
 * to play. Every LIVE row opens the live session page, the signed-in
 * technician's own included: there they watch their own session from that tab.
 */
export function sessionHref(row: SessionRow & Pick<RecordingSummary, 'id'>, liveRows: LiveRows | null): string | null {
  if (isLiveRow(row, liveRows)) return routes.devices.liveSession(row.id);
  return row.recordingId && canOpenSession(row) ? routes.devices.remoteSessionRecording(row.recordingId) : null;
}

/**
 * Why a row's Open is off, where nothing else in the row says it: a session that recorded nothing has no tag and no
 * expiry. A processing, failed, expired or deleted row reads its state already, and gets no hint.
 */
export function openDisabledHint(
  row: SessionRow & Pick<RecordingSummary, 'id'>,
  liveRows: LiveRows | null,
): string | null {
  if (row.recordingState !== 'none' || sessionHref(row, liveRows) !== null) return null;
  return 'This session has no recording';
}

/** The EXPIRES column's filter values (Figma 1695-88210). */
export type ExpiresFilterValue = 'kept' | 'expiring' | 'expired';

export const EXPIRES_FILTER_OPTIONS: { id: ExpiresFilterValue; value: ExpiresFilterValue; label: string }[] = [
  { id: 'kept', value: 'kept', label: 'Kept' },
  { id: 'expiring', value: 'expiring', label: 'Expiring' },
  { id: 'expired', value: 'expired', label: 'Expired' },
];

const HOUR_MS = 60 * 60 * 1000;

/** "Expiring" = deleted within this window - the same 7 days the server's EXPIRING filter uses. */
export const EXPIRING_WINDOW_MS = 7 * 24 * HOUR_MS;

/**
 * Which EXPIRES filter a row falls under; null for a row no filter picks:
 * nothing that expires (processing, failed, deleted, not recorded), or a
 * recording with more than a week left.
 */
export function expiresFilterValue(row: SessionRow, now: number): ExpiresFilterValue | null {
  if (row.kept) return 'kept';
  if (row.recordingState === 'expired') return 'expired';
  if (row.recordingState === 'ready' && row.expiresAt && Date.parse(row.expiresAt) - now < EXPIRING_WINDOW_MS) {
    return 'expiring';
  }
  return null;
}

/**
 * An ended session whose recording is on its way: no file to open yet, and the server still expects one (processing,
 * or a state that already counts a file the list does not show yet).
 */
export function isAwaitingRecording(
  session: Pick<RecordingSummary, 'live' | 'recordingState' | 'recordingId'>,
): boolean {
  return (
    !session.live &&
    session.recordingId === null &&
    (session.recordingState === 'processing' || session.recordingState === 'ready')
  );
}

/** Only a session with something left to play opens the recording page. */
export function canOpenSession(row: SessionRow): boolean {
  return row.recordingState === 'ready' && row.recordingId !== null;
}

/** Keep is offered for a recording that can still play and is not kept yet. */
export function canKeepSession(row: SessionRow): boolean {
  return !row.kept && row.recordingState === 'ready';
}

/**
 * A delete takes the whole session, so a session that recorded nothing can go
 * too, and so can one whose recording failed, expired or was deleted before.
 * The server refuses a running session, a recording still being processed and
 * a kept one.
 */
export function canDeleteSession(row: SessionRow): boolean {
  return !row.live && !row.kept && row.recordingState !== 'processing';
}

/** A row whose recording is gone reads greyed out. */
export function isRecordingGone(row: SessionRow): boolean {
  return row.recordingState === 'expired' || row.recordingState === 'deleted';
}

/**
 * "Expires in N hours" under the expiry date once less than a day is left.
 * A file past its expiry stays until the daily sweep removes it, so the
 * countdown bottoms out at one hour instead of going negative.
 */
export function expiresSoonLabel(expiresAt: string, now: number): string | null {
  const left = Date.parse(expiresAt) - now;
  if (Number.isNaN(left) || left >= 24 * HOUR_MS) return null;
  const hours = Math.max(1, Math.floor(left / HOUR_MS));
  return `Expires in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
