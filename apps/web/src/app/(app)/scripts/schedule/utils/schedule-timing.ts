import {
  DURATION_UNIT_LABELS,
  DURATION_UNIT_SECONDS,
  DURATION_UNIT_VALUES,
  type DurationUnit,
  fromScheduleInstant,
  isDeviceLocalTime,
  isRetryOnReconnect,
  MIN_REPEAT_MINUTES,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { ScheduleOfflineBehavior, ScheduleTimeReference, ScriptScheduleTrigger } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDate, formatTime } from '@/lib/format-date';
import { asInstant, type Instant } from '@/lib/graphql-scalars';

/**
 * Timing model helpers for Script Schedules v2.
 *
 * The backend models a schedule's timing as two fields on `ScriptSchedule`:
 * - `startAt: Instant` — the first scheduled run as an absolute **UTC** instant,
 *   pinned to a 30-minute boundary (`xx:00` / `xx:30`).
 * - `repeat: Long` — the recurrence interval in **seconds**, a whole number of
 *   30-minute slots (1800, 3600, …). Null / 0 means a one-shot that fires once
 *   at `startAt`.
 *
 * The UI offers repeat units that are all clean multiples of 1800s (hour, day,
 * week, month=30d), so anything produced here is always a valid interval on the
 * backend's 30-minute grid. (The backend also accepts a bare 30-minute repeat;
 * the UI simply doesn't surface a sub-hour unit.)
 *
 * Two more fields say what happens when the instant arrives and the device is
 * NOT there — `offlineBehavior` (`SKIP` | `RETRY_ON_RECONNECT`) and, for the
 * latter, `reconnectWindowSeconds`, the deadline past which a queued run is
 * abandoned. They live here because they only mean anything against a scheduled
 * time: a `DEVICE_ONLINE` schedule already fires on reconnect, so it has no
 * offline case to decide and is stored as `SKIP`.
 *
 * **Everything the user sees or picks is their LOCAL wall clock**; UTC exists
 * only on the wire. See {@link toScheduleInstant}.
 */

/**
 * What fires a schedule. `DATE_TIME` is the timing model above; `DEVICE_ONLINE`
 * is event-driven — it carries no `startAt` / `repeat` at all (the backend keeps
 * both null), so every timing control and column is meaningless for it.
 */
export function triggerToLabel(trigger: ScriptScheduleTrigger | string | null | undefined): string {
  return trigger === ScriptScheduleTrigger.DEVICE_ONLINE ? 'Device Online' : 'Date & Time';
}

/**
 * A stored `timeReference` narrowed to the two arms this client knows, anything
 * else — including null — settling on SERVER. The counterpart of
 * {@link resolveOfflineBehavior}, and needed for the same two reasons: the write
 * side declares the field nullable with a documented default, and Relay's enum
 * types carry a member the input cannot accept.
 */
export function resolveTimeReference(
  timeReference: ScheduleTimeReference | string | null | undefined,
): ScheduleTimeReference {
  return isDeviceLocalTime(timeReference) ? ScheduleTimeReference.DEVICE_LOCAL : ScheduleTimeReference.SERVER;
}

/** Largest-first, so `secondsToDuration` picks the coarsest exact unit. */
const UNITS_DESC: DurationUnit[] = [...DURATION_UNIT_VALUES].sort(
  (a, b) => DURATION_UNIT_SECONDS[b] - DURATION_UNIT_SECONDS[a],
);

/** An `[interval] [unit]` pair → the seconds the backend stores. */
export function durationToSeconds(interval: number, unit: DurationUnit): number {
  return interval * DURATION_UNIT_SECONDS[unit];
}

/** Stored seconds → the coarsest exact `{ interval, unit }` for the form. */
export function secondsToDuration(seconds: number): { interval: number; unit: DurationUnit } {
  for (const unit of UNITS_DESC) {
    const size = DURATION_UNIT_SECONDS[unit];
    if (seconds % size === 0) return { interval: seconds / size, unit };
  }
  // Only a value off the MINUTE grid entirely lands here — 90 seconds, say.
  // `repeat` cannot be one (the runner's grid is 30 minutes, and the dropdown
  // goes down to it), but `reconnectWindowSeconds` is a plain deadline the
  // backend puts no grid on, so a window authored outside this UI can be. Shown
  // as the floor because that is at least a value the form can save; keeping the
  // stored one untouched is `resolveDurationSeconds`'s job.
  return { interval: MIN_REPEAT_MINUTES, unit: 'minute' };
}

/**
 * The seconds to persist for a form currently showing `{ interval, unit }`.
 *
 * Round-tripping through the form is lossy for any stored value the unit
 * dropdown cannot express (see {@link secondsToDuration}). Writing the rounded
 * display back would change a setting on an edit that never touched it: a rename
 * would silently re-time how often a schedule runs, or shorten how long its
 * queued runs stay alive.
 *
 * Kept rather than deleted along with the sub-hour repeat gap it was written
 * for: the guarantee is about what the FORM can express, and the form is a lossy
 * view of a seconds field by nature — which the reconnect window, on no grid at
 * all, makes reachable again.
 *
 * So the stored value wins for as long as the form still shows exactly what it
 * rounds to. The moment the user moves the interval or the unit off that
 * reading, their choice wins — including the case where they re-pick the same
 * reading deliberately, which is indistinguishable from never having touched it
 * and is treated as "leave it alone".
 */
export function resolveDurationSeconds(
  interval: number,
  unit: DurationUnit,
  storedSeconds: number | null | undefined,
): number {
  const fromForm = durationToSeconds(interval, unit);
  if (!storedSeconds || storedSeconds <= 0) return fromForm;
  const shown = secondsToDuration(storedSeconds);
  return shown.interval === interval && shown.unit === unit ? storedSeconds : fromForm;
}

/**
 * What a schedule does with a device that is offline when it fires, for the
 * read-only info bar: "Retry for 1 Week", or "Skip this Run".
 *
 * A queueing schedule with no window reads as plain "Retry" rather than
 * inventing a deadline — the schema calls the window optional, and only the
 * backend knows what it means to leave it unset.
 */
export function offlineBehaviorToLabel(
  behavior: ScheduleOfflineBehavior | string | null | undefined,
  reconnectWindowSeconds: number | null | undefined,
): string {
  if (!isRetryOnReconnect(behavior)) return 'Skip this Run';
  if (!reconnectWindowSeconds || reconnectWindowSeconds <= 0) return 'Retry';
  return `Retry for ${secondsToLabel(reconnectWindowSeconds)}`;
}

/**
 * A stored `offlineBehavior` narrowed to the two arms this client knows, with
 * anything else — including null — settling on SKIP.
 *
 * The read side of the schema declares the field non-null, so TypeScript says
 * this cannot happen; the WRITE side declares it nullable and documents null as
 * meaning SKIP, which is the same rule from the other direction. Normalising
 * here keeps the two consistent without trusting either declaration: Relay also
 * types every schema enum with a `%future added value` member, so a value added
 * server-side would otherwise flow into a union that cannot hold it.
 *
 * SKIP is the safe arm to land on — it is what every schedule authored before
 * the field existed already does.
 */
export function resolveOfflineBehavior(
  behavior: ScheduleOfflineBehavior | string | null | undefined,
): ScheduleOfflineBehavior {
  return isRetryOnReconnect(behavior) ? ScheduleOfflineBehavior.RETRY_ON_RECONNECT : ScheduleOfflineBehavior.SKIP;
}

/**
 * A span of seconds as "1 Week" / "3 Days" — the coarsest unit that divides it
 * exactly, matching what the form's own interval + unit pair would have shown.
 *
 * Shared by the two read-only spans a schedule carries (its repeat cadence and
 * its reconnect window) so they cannot drift apart in wording.
 */
function secondsToLabel(seconds: number): string {
  for (const unit of UNITS_DESC) {
    const size = DURATION_UNIT_SECONDS[unit];
    if (seconds % size === 0) {
      const n = seconds / size;
      return n === 1 ? `1 ${DURATION_UNIT_LABELS[unit]}` : `${n} ${DURATION_UNIT_LABELS[unit]}s`;
    }
  }
  // Off the minute grid entirely — rounded up so a stray value reads as a
  // duration rather than as "0 Minutes". Reachable for a reconnect window, which
  // the backend puts on no grid at all.
  const mins = Math.max(1, Math.ceil(seconds / 60));
  return mins === 1 ? '1 Minute' : `${mins} Minutes`;
}

/** Human label for the REPEAT column / info bar ("Once", "1 Week", "3 Days"). */
export function repeatToLabel(repeat: number | null | undefined): string {
  if (!repeat || repeat <= 0) return 'Once';
  return secondsToLabel(repeat);
}

/**
 * How a DEVICE_LOCAL time is named wherever it is shown OUTSIDE the form, which
 * is the only place its reading is otherwise invisible: the digits are each
 * device's own wall clock, and a bare "6:00 PM" in a table reads as the viewer's.
 */
export const DEVICE_LOCAL_TIME_NOTE = 'Device local';

/**
 * The date + time the user picked (a local `Date`) → the UTC instant to store.
 * Output: `yyyy-MM-dd'T'HH:mm:ss'Z'`.
 *
 * A real conversion, which is the whole point. This used to stamp the picked
 * wall-clock digits as UTC verbatim — the stored string then MATCHED the picker
 * character for character, and was wrong by the viewer's offset for everyone
 * outside Greenwich: a Kyiv user picking "02:00 PM" got a schedule that fired at
 * 5 PM their time, while every screen in the app kept showing 2 PM. `startAt` is
 * an absolute instant, so the only field that can carry the user's intent is the
 * instant itself.
 *
 * The 30-minute boundary the backend requires is preserved by the picker: the
 * slots are generated from that grid backwards through the local offset (see
 * `getTimeSlotOptions`), so a picked slot is on the boundary by
 * construction, in UTC, in any timezone.
 *
 * DEVICE_LOCAL asks for the opposite, and asks for it deliberately: there the
 * user is not picking a moment at all, they are picking a reading of a clock
 * each device owns, so the wall-clock digits ARE the payload and the `Z` is
 * carrier, not meaning. The bug this looks like — stamping local digits as UTC —
 * is what the field was added to express. Built from the local components rather
 * than by shifting the instant, so a DST boundary between now and the picked day
 * cannot move a digit.
 */
export function toScheduleInstant(date: Date, timeReference?: ScheduleTimeReference | string | null): Instant {
  if (!isDeviceLocalTime(timeReference)) return asInstant(date.toISOString().replace(/\.\d+Z$/, 'Z'));
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const wallClock = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return asInstant(`${wallClock}T${pad(date.getHours())}:${pad(date.getMinutes())}:00Z`);
}

/**
 * A stored `startAt` → the `{ date, time }` pair the info bar / table render, in
 * the viewer's local timezone — the same clock the picker offered and the same
 * one the execution timestamps beside it already use.
 *
 * Split into two strings rather than one because the design stacks them; the
 * strings themselves come from `@/lib/format-date`, so a schedule's start reads
 * exactly like every other date in the app. The pair used to be built from
 * inline `toLocale*` options inherited from the pre-migration app, which is how
 * one column ended up spelling the same instant differently from the execution
 * row under it.
 *
 * A DEVICE_LOCAL start is the exception, and the one span here that is NOT the
 * viewer's clock: it stores a wall clock, so it is shown as that reading, the
 * same on every screen. Nothing in the row says so — the schedule's own form
 * names the reading, and the columns beside it have no room to.
 */
export function formatScheduleStartAt(
  iso: string | null | undefined,
  timeReference?: ScheduleTimeReference | string | null,
): { date: string; time: string } {
  if (!iso) return { date: EMPTY_VALUE, time: EMPTY_VALUE };
  const d = fromScheduleInstant(iso, timeReference);
  return { date: formatDate(d), time: formatTime(d) };
}
