import type { UiDeviceLog } from '../types/device-log.types';
import { isInstantAfter } from './device-log-time';

/** After a failed poll: 15 s, then 30 s until the first success. */
export const BACKOFF_STEPS_MS = [15_000, 30_000] as const;

/** Holds at the last step instead of running off the end of the ladder. */
export function pollBackoffMs(failures: number): number {
  const step = Math.min(Math.max(failures, 0), BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[step] ?? BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1];
}

/**
 * Newest-first merge of one poll into the lines already on screen. `from` is
 * inclusive, so the line it names comes back every tick and is dropped here;
 * keys already held are dropped too, since a retried page repeats them.
 */
export function mergeFreshLines(held: UiDeviceLog[], drained: UiDeviceLog[], from: string): UiDeviceLog[] | null {
  const newer = drained.filter(line => isInstantAfter(line.timestamp, from));
  if (newer.length === 0) return null;
  const known = new Set(held.map(line => line.key));
  const unseen = newer.filter(line => !known.has(line.key));
  return unseen.length === 0 ? null : [...unseen, ...held];
}
