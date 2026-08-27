import { ScheduleOfflineBehavior, ScriptScheduleTrigger } from '@/generated/schema-enums';
import { formatDate, formatTime } from '@/lib/format-date';

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

/** True when the schedule is event-driven and has no date/time/repeat. */
export function isEventTrigger(trigger: ScriptScheduleTrigger | string | null | undefined): boolean {
  return trigger === ScriptScheduleTrigger.DEVICE_ONLINE;
}

/**
 * The units an `[interval] [unit]` pair is built from, finest first — one list,
 * so the dropdowns, the form schema and the seconds table cannot drift apart.
 *
 * Two different settings are spelled in this vocabulary, and they are NOT the
 * same quantity: the repeat cadence (`repeat`, how often the schedule fires) and
 * the reconnect window (`reconnectWindowSeconds`, how long an offline device's
 * queued run is still worth running). They share the units and the seconds
 * table; nothing else. In particular {@link MIN_REPEAT_MINUTES} is a property of
 * the RUNNER'S grid and constrains the cadence only — a reconnect window is a
 * plain deadline and may sit anywhere.
 */
export const DURATION_UNIT_VALUES = ['minute', 'hour', 'day', 'week', 'month'] as const;

export type DurationUnit = (typeof DURATION_UNIT_VALUES)[number];

// `Record<DurationUnit, …>` on both maps: adding a unit above is then a compile
// error until its seconds and its label exist.
const UNIT_SECONDS: Record<DurationUnit, number> = {
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000, // 30 days — the only "calendar" unit the seconds model can approximate
};

const UNIT_LABEL: Record<DurationUnit, string> = {
  minute: 'Minute',
  hour: 'Hour',
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

/**
 * The smallest cadence the backend's grid allows: `repeat` must be a whole
 * number of 30-minute slots, so 30 minutes is one slot and there is nothing
 * below it. Every other unit clears this by construction (an hour is two slots),
 * which is why the rule only ever has to be enforced on minutes.
 */
export const MIN_REPEAT_MINUTES = 30;

/** Largest-first, so `secondsToDuration` picks the coarsest exact unit. */
const UNITS_DESC: DurationUnit[] = [...DURATION_UNIT_VALUES].sort((a, b) => UNIT_SECONDS[b] - UNIT_SECONDS[a]);

export const DURATION_UNIT_OPTIONS: { label: string; value: DurationUnit }[] = DURATION_UNIT_VALUES.map(value => ({
  value,
  label: UNIT_LABEL[value],
}));

/**
 * Snaps a repeat interval onto what its unit can legally express. Only minutes
 * can be illegal — see {@link MIN_REPEAT_MINUTES} — so every other unit is
 * returned untouched.
 *
 * Used when the unit CHANGES: switching "1 Day" to minutes would otherwise leave
 * "1 Minute" sitting in the form, a value the user never typed and cannot save.
 */
export function snapRepeatInterval(interval: number, unit: DurationUnit): number {
  if (unit !== 'minute') return interval;
  if (!Number.isFinite(interval) || interval < MIN_REPEAT_MINUTES) return MIN_REPEAT_MINUTES;
  return Math.ceil(interval / MIN_REPEAT_MINUTES) * MIN_REPEAT_MINUTES;
}

/** An `[interval] [unit]` pair → the seconds the backend stores. */
export function durationToSeconds(interval: number, unit: DurationUnit): number {
  return interval * UNIT_SECONDS[unit];
}

/** Stored seconds → the coarsest exact `{ interval, unit }` for the form. */
export function secondsToDuration(seconds: number): { interval: number; unit: DurationUnit } {
  for (const unit of UNITS_DESC) {
    const size = UNIT_SECONDS[unit];
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
 * True when a schedule QUEUES a run for a device that was offline at its
 * scheduled time, instead of logging the miss and moving on.
 *
 * The counterpart of {@link isEventTrigger}, and the reason both are predicates
 * rather than `=== ENUM.X` at the call sites: Relay types every schema enum with
 * a `%future added value` member, so a stored value this client doesn't know
 * reads as neither arm. Asking "is it the non-default one" answers that safely —
 * an unknown behavior falls back to SKIP, which is also what the backend
 * documents as the default.
 */
export function isRetryOnReconnect(behavior: ScheduleOfflineBehavior | string | null | undefined): boolean {
  return behavior === ScheduleOfflineBehavior.RETRY_ON_RECONNECT;
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
 * What the "Stop Retry after" pair starts at — the design's own default
 * (node 460:63425). It is only ever a SEED: the field is required whenever
 * RETRY_ON_RECONNECT is picked, so every saved schedule carries a window the
 * user could see, and `reconnectWindowSeconds` is never written blind.
 */
export const DEFAULT_RECONNECT_WINDOW: { interval: number; unit: DurationUnit } = { interval: 1, unit: 'week' };

/** Human label for the REPEAT column / info bar ("Once", "1 Week", "3 Days"). */
/**
 * A span of seconds as "1 Week" / "3 Days" — the coarsest unit that divides it
 * exactly, matching what the form's own interval + unit pair would have shown.
 *
 * Shared by the two read-only spans a schedule carries (its repeat cadence and
 * its reconnect window) so they cannot drift apart in wording.
 */
function secondsToLabel(seconds: number): string {
  for (const unit of UNITS_DESC) {
    const size = UNIT_SECONDS[unit];
    if (seconds % size === 0) {
      const n = seconds / size;
      return n === 1 ? `1 ${UNIT_LABEL[unit]}` : `${n} ${UNIT_LABEL[unit]}s`;
    }
  }
  // Off the minute grid entirely — rounded up so a stray value reads as a
  // duration rather than as "0 Minutes". Reachable for a reconnect window, which
  // the backend puts on no grid at all.
  const mins = Math.max(1, Math.ceil(seconds / 60));
  return mins === 1 ? '1 Minute' : `${mins} Minutes`;
}

export function repeatToLabel(repeat: number | null | undefined): string {
  if (!repeat || repeat <= 0) return 'Once';
  return secondsToLabel(repeat);
}

const SLOTS_PER_DAY = 48;
const SLOT_MINUTES = 30;

/**
 * The minute-of-hour the local time slots sit on.
 *
 * Almost everywhere this is 0 and the slots are the plain `xx:00` / `xx:30` of
 * the local day. Zones offset by 45 minutes (Kathmandu, Chatham, Eucla) are the
 * exception: there a local `xx:00` is `xx:15` in UTC, which the backend rejects,
 * so their grid shifts to `xx:15` / `xx:45` — the local readings that DO land on
 * the UTC grid. Those users pick a time that looks unusual but actually runs;
 * the alternative is a save that fails with nothing they can do about it.
 *
 * Read per call, never once at module load: on the server this would be the
 * *server's* timezone, and this module is imported during the prerender pass.
 *
 * The picked date doesn't enter into it. Every DST transition moves the offset
 * by a whole hour (Lord Howe's 30 minutes is the outlier), so the remainder
 * mod 30 holds all year and the grid never has to be rebuilt per date.
 */
function slotBaseMinutes(): number {
  // getTimezoneOffset() is (UTC − local) in minutes, so UTC lands on a boundary
  // exactly when (localMinutesOfDay + offset) % 30 === 0.
  const offset = new Date().getTimezoneOffset();
  return ((-offset % SLOT_MINUTES) + SLOT_MINUTES) % SLOT_MINUTES;
}

/** Minutes since local midnight → the `HH:mm` the form stores. */
function slotValue(minutesOfDay: number): string {
  const hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Minutes since local midnight → the reading shown in the dropdown.
 *
 * Formatted through the app's date module like every other clock reading, so a
 * 24-hour locale sees "14:15" rather than a hand-rolled AM/PM. The reference day
 * is arbitrary and never leaves this function: a local `Date` formatted in the
 * local zone returns the same wall clock it was built from.
 */
function slotLabel(minutesOfDay: number): string {
  return formatTime(new Date(1970, 0, 1, Math.floor(minutesOfDay / 60), minutesOfDay % 60));
}

/**
 * The Time dropdown's options — one per 30-minute slot of the **local** day,
 * shifted onto the grid `startAt` must land on (see {@link slotBaseMinutes}).
 * `value` is 24h `HH:mm` (what the form stores); `label` is the 12h form.
 *
 * A function rather than a const because the grid depends on the viewer's
 * timezone, which a module evaluated during prerender does not know.
 *
 * `forDate` drops the slots that have already gone by: a schedule cannot start
 * in the past, and offering "8:00 AM" at noon means offering a save the backend
 * refuses. Only a `forDate` of TODAY narrows the list — a later day keeps the
 * full 48, and so does a day not yet picked (the user may well be about to pick
 * tomorrow; picking today afterwards is what clears a time that has gone by).
 * A PAST day keeps them too: it can only be a stored start, and the value that
 * schedule already holds has to stay readable.
 */
export function getTimeSlotOptions(forDate?: Date | null): { value: string; label: string }[] {
  const base = slotBaseMinutes();
  const cutoff = forDate && isToday(forDate) ? nowMinutesOfDay() : -1;
  return Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
    const minutesOfDay = base + slot * SLOT_MINUTES;
    return { value: slotValue(minutesOfDay), label: slotLabel(minutesOfDay), minutesOfDay };
  })
    .filter(slot => slot.minutesOfDay > cutoff)
    .map(({ value, label }) => ({ value, label }));
}

/**
 * The dropdown reading for an `HH:mm` the option list no longer carries — a
 * stored start whose slot has already gone by today. The form's value has to
 * stay VISIBLE (it is what will be saved if nothing else changes), so the Select
 * gets its option back with the same label the live slots use.
 */
export function slotToLabel(slot: string): string {
  const [hours, minutes] = slot.split(':').map(Number);
  return slotLabel(hours * 60 + minutes);
}

/** Minutes since local midnight, right now. */
function nowMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Same local calendar day as right now. */
function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

/**
 * Local midnight today — the earliest day a schedule may start, and what the
 * date picker takes as its `fromDate`.
 *
 * Midnight rather than "now": the calendar selects whole days, so today has to
 * stay pickable all day long. Which of today's SLOTS are still available is the
 * time dropdown's half of the same rule ({@link getTimeSlotOptions}).
 *
 * Built per call — a module-level constant would freeze the boundary at import
 * time and let a tab left open overnight pick yesterday.
 */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Whether a picked day + slot has already gone by. Compared as instants, so a
 * slot that is still minutes away passes.
 */
export function isScheduleStartInPast(date: Date | null | undefined, slot: string): boolean {
  if (!date || !slot) return false;
  return applyTimeSlot(date, slot).getTime() < Date.now();
}

/** What both the field and the schema say about a start that has gone by. */
export const PAST_START_MESSAGE = 'Start time must be in the future';

/**
 * The "no start in the past" rule as the FORM applies it — stated once, and read
 * by both the fields (which show it the moment it happens) and the schema (which
 * refuses the save).
 *
 * The exemption is the whole reason it needs a name: a schedule already stored
 * with a past start keeps it. Recurring schedules legitimately started long ago,
 * and without this, renaming one would demand re-picking its date. So the stored
 * instant stays legal for exactly as long as the form still shows it; moving
 * either half makes the choice a new one, held to the same rule as any other.
 */
export function isStartInPastAndChanged(
  date: Date | null | undefined,
  slot: string,
  storedIso: string | null | undefined,
): boolean {
  if (!isScheduleStartInPast(date, slot) || !date) return false;
  const stored = storedIso ? fromScheduleInstant(storedIso).getTime() : null;
  return applyTimeSlot(date, slot).getTime() !== stored;
}

/**
 * A picked date → the local `HH:mm` slot it sits on (empty when no date yet).
 *
 * A stored `startAt` always lands on a slot exactly, since the backend enforces
 * the same grid this builds from; the flooring is for values authored outside
 * this UI, and it keeps them on a slot the dropdown can actually show.
 */
export function dateToTimeSlot(date: Date | null | undefined): string {
  if (!date) return '';
  const base = slotBaseMinutes();
  const minutesOfDay = date.getHours() * 60 + date.getMinutes();
  const slot = Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.floor((minutesOfDay - base) / SLOT_MINUTES)));
  return slotValue(base + slot * SLOT_MINUTES);
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
 * {@link getTimeSlotOptions}), so a picked slot is on the boundary by
 * construction, in UTC, in any timezone.
 */
export function toScheduleInstant(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}

/**
 * Inverse of {@link toScheduleInstant}: a stored UTC instant → the `Date` for
 * that moment, which the picker and every formatter below then read through the
 * viewer's own clock.
 *
 * Trivial by design — it stays a named seam so the two directions of the
 * conversion remain findable together.
 */
export function fromScheduleInstant(iso: string): Date {
  return new Date(iso);
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
 */
export function formatScheduleStartAt(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '—', time: '—' };
  const d = new Date(iso);
  return { date: formatDate(d), time: formatTime(d) };
}
