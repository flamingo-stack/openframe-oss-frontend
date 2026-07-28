import { format } from 'date-fns';
import { ScriptScheduleTrigger } from '@/generated/schema-enums';

/**
 * Timing model helpers for Script Schedules v2.
 *
 * The backend models a schedule's timing as two fields on `ScriptSchedule`:
 * - `startAt: Instant` — the first scheduled run, pinned to a 30-minute boundary
 *   (`xx:00` / `xx:30`).
 * - `repeat: Long` — the recurrence interval in **seconds**, a whole number of
 *   30-minute slots (1800, 3600, …). Null / 0 means a one-shot that fires once
 *   at `startAt`.
 *
 * The UI offers repeat units that are all clean multiples of 1800s (hour, day,
 * week, month=30d), so anything produced here is always a valid interval on the
 * backend's 30-minute grid. (The backend also accepts a bare 30-minute repeat;
 * the UI simply doesn't surface a sub-hour unit.)
 */

/**
 * What fires a schedule. `DATE_TIME` is the timing model above; `DEVICE_ONLINE`
 * is event-driven — it carries no `startAt` / `repeat` at all (the backend keeps
 * both null), so every timing control and column is meaningless for it.
 */
export function triggerToLabel(trigger: ScriptScheduleTrigger | string | null | undefined): string {
  return trigger === ScriptScheduleTrigger.DEVICE_ONLINE ? 'Device Online' : 'Date & Time';
}

/** True when the schedule is event-driven and has no date/time/repeat. */
export function isEventTrigger(trigger: ScriptScheduleTrigger | string | null | undefined): boolean {
  return trigger === ScriptScheduleTrigger.DEVICE_ONLINE;
}

const UNIT_SECONDS = {
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000, // 30 days — the only "calendar" unit the seconds model can approximate
} as const;

export type RepeatUnit = keyof typeof UNIT_SECONDS;

const UNIT_LABEL: Record<RepeatUnit, string> = {
  hour: 'Hour',
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

/** Largest-first, so `secondsToRepeatParts` picks the coarsest exact unit. */
const UNITS_DESC: RepeatUnit[] = ['month', 'week', 'day', 'hour'];

export const REPEAT_UNIT_OPTIONS: { label: string; value: RepeatUnit }[] = [
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

/** Repeat form parts → the `repeat` seconds the backend stores. */
export function repeatPartsToSeconds(interval: number, unit: RepeatUnit): number {
  return interval * UNIT_SECONDS[unit];
}

/** `repeat` seconds → the coarsest exact `{ interval, unit }` for the form. */
export function secondsToRepeatParts(seconds: number): { interval: number; unit: RepeatUnit } {
  for (const unit of UNITS_DESC) {
    const size = UNIT_SECONDS[unit];
    if (seconds % size === 0) return { interval: seconds / size, unit };
  }
  // A sub-hour value (only reachable if authored outside this UI) rounds up to hours.
  return { interval: Math.max(1, Math.round(seconds / UNIT_SECONDS.hour)), unit: 'hour' };
}

/** Human label for the REPEAT column / info bar ("Once", "1 Week", "3 Days"). */
export function repeatToLabel(repeat: number | null | undefined): string {
  if (!repeat || repeat <= 0) return 'Once';
  for (const unit of UNITS_DESC) {
    const size = UNIT_SECONDS[unit];
    if (repeat % size === 0) {
      const n = repeat / size;
      return n === 1 ? `1 ${UNIT_LABEL[unit]}` : `${n} ${UNIT_LABEL[unit]}s`;
    }
  }
  const mins = Math.round(repeat / 60);
  return mins === 1 ? '1 Minute' : `${mins} Minutes`;
}

/**
 * The Time dropdown's options — one per 30-minute slot of the day, which is
 * exactly the grid `startAt` must land on. `value` is 24h `HH:mm` (what the
 * form stores); `label` is the 12h form the design shows ("02:00 AM").
 */
export const TIME_SLOT_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, slot) => {
  const hours = Math.floor(slot / 2);
  const minutes = slot % 2 === 0 ? 0 : 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const mm = String(minutes).padStart(2, '0');
  return {
    value: `${String(hours).padStart(2, '0')}:${mm}`,
    label: `${String(hour12).padStart(2, '0')}:${mm} ${period}`,
  };
});

/** A picked date → the `HH:mm` slot it sits on (empty when no date yet). */
export function dateToTimeSlot(date: Date | null | undefined): string {
  if (!date) return '';
  const minutes = date.getMinutes() < 30 ? 0 : 30;
  return `${String(date.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Applies an `HH:mm` slot to the picked date. Choosing a time before a date
 * anchors it to today — the same fallback the core date-time picker uses.
 */
export function applyTimeSlot(date: Date | null | undefined, slot: string): Date {
  const [hours, minutes] = slot.split(':').map(Number);
  const next = date ? new Date(date) : new Date();
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/**
 * The user picks a wall-clock time; we stamp it as UTC verbatim (no timezone
 * shift). This keeps the stored instant exactly on the 30-minute boundary the
 * picker enforced, regardless of the viewer's timezone, and mirrors how the
 * value is read back for display. Output: `yyyy-MM-dd'T'HH:mm:ss'Z'`.
 */
export function toScheduleInstant(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

/**
 * Inverse of {@link toScheduleInstant}: a stored UTC instant → a local `Date`
 * whose wall-clock components equal the UTC ones, so the picker shows the same
 * time that was saved.
 */
export function fromScheduleInstant(iso: string): Date {
  const d = new Date(iso);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
}

/** A stored `startAt` → the `{ date, time }` pair the info bar / table render (UTC-pinned). */
export function formatScheduleStartAt(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '—', time: '—' };
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return { date, time };
}
