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

/**
 * Which EXPIRES filter a row falls under; null for a row with nothing that
 * expires (processing, failed, deleted, not recorded), which no filter picks.
 */
export function expiresFilterValue(row: SessionRow): ExpiresFilterValue | null {
  if (row.kept) return 'kept';
  if (row.recordingState === 'expired') return 'expired';
  if (row.recordingState === 'ready' && row.expiresAt) return 'expiring';
  return null;
}

/** Only a session with something left to play opens the recording page. */
export function canOpenSession(row: SessionRow): boolean {
  return row.recordingState === 'ready' && row.recordingId !== null;
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

const HOUR_MS = 60 * 60 * 1000;

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
