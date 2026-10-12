import { REMOTE_SESSION_KEEP_REASON_LABELS } from '@flamingo-stack/openframe-frontend-core/components/features';
import { formatDate } from '@/lib/format-date';
import type { RecordingKeep, RecordingStorage } from '../../types/session-recording';
import { formatBytes } from './format';

// How a Keep reads on the recording page, in the Remote Sessions list and in
// the Release Keeping dialog.

/** The reason as it reads after "for": an "Other" Keep reads as its own note. */
export function keepReasonText(keep: Pick<RecordingKeep, 'reason' | 'note'>): string {
  if (keep.reason === 'OTHER' && keep.note) return keep.note;
  return REMOTE_SESSION_KEEP_REASON_LABELS[keep.reason];
}

/**
 * The original expiry for the Release dialog's "It was due to expire on", set
 * only when releasing adds the grace period - the recording is due sooner than
 * it would expire on release. Null when releasing leaves the expiry as it was.
 */
export function releaseDueOn(keep: Pick<RecordingKeep, 'dueAt' | 'expiresAtOnRelease'>): string | null {
  if (!keep.dueAt || !keep.expiresAtOnRelease) return null;
  return Date.parse(keep.expiresAtOnRelease) > Date.parse(keep.dueAt) ? formatDate(keep.dueAt) : null;
}

/** The Keep dialog's "Kept recordings use ...": "612 MB of 50 GB" once the storage is known. */
export function keptUsageText(storage: RecordingStorage | undefined): string {
  if (!storage) return 'their own allowance';
  return `${formatBytes(storage.keptBytes)} of ${formatBytes(storage.keptLimitBytes)}`;
}
