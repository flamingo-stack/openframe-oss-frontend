import type { RecordingSummary } from '../../types/session-recording';

// What a Remote Sessions row may do and how it reads, from its recording's
// state. Shared by the device tab and the tenant-wide sessions page, so the
// two lists never disagree about which rows open or delete.

type SessionRow = Pick<RecordingSummary, 'recordingState' | 'kept' | 'expiresAt' | 'recordingId'>;

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

/** Only a session with something left to play opens the recording page. */
export function canOpenSession(row: SessionRow): boolean {
  return row.recordingState === 'ready' && row.recordingId !== null;
}

/** Keep is offered for a recording that can still play and is not kept yet. */
export function canKeepSession(row: SessionRow): boolean {
  return !row.kept && row.recordingState === 'ready';
}

/**
 * The server refuses a running session and a kept file, and a session that
 * recorded nothing has nothing to delete. Failed and expired rows can still be
 * deleted, per the design.
 */
export function canDeleteSession(row: SessionRow): boolean {
  if (row.kept) return false;
  return row.recordingState === 'ready' || row.recordingState === 'failed' || row.recordingState === 'expired';
}

/** A row whose recording is gone reads greyed out. */
export function isRecordingGone(row: SessionRow): boolean {
  return row.recordingState === 'expired' || row.recordingState === 'deleted';
}

/**
 * Why the recording page has nothing to play, under "Session recording
 * unavailable": a deleted or expired recording says so from its state, and
 * "processing" is left for files that could not be fetched. Null while the
 * recording may still play.
 */
export function recordingUnavailableNote(row: Pick<SessionRow, 'recordingState'>, fetchFailed: boolean): string | null {
  if (row.recordingState === 'deleted') return 'This recording was deleted';
  if (row.recordingState === 'expired') return 'This recording has expired';
  return fetchFailed ? 'The video is still being processed, check back in a moment' : null;
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
