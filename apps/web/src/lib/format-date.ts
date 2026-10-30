import { format as formatPattern } from 'date-fns';
import { EMPTY_VALUE } from './empty-value';
import { parseInstant, parseLocalDate } from './graphql-scalars';

type DateInput = string | number | Date;

/**
 * The input as a `Date`, or null when it is missing or unparseable — the guard
 * every formatter here applies, exported for the callers that need the `Date`
 * itself (date arithmetic) rather than a string. `0` is a real instant, not a
 * missing one.
 */
export function toValidDate(input: DateInput | null | undefined): Date | null {
  if (input == null || input === '') return null;
  // A `Date` scalar is a local day; every other string the API sends is an instant.
  if (typeof input === 'string') return parseLocalDate(input) ?? parseInstant(input);
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The locale every date here is written in: the language the user put first in
 * the browser's own Languages setting (`navigator.language`), not `Intl`'s
 * default. The two differ on macOS, where Chrome's default locale is the OS
 * language: a user with an English (US) Mac who chose English (Australia) in
 * Chrome gets `en-AU` here and `en-US` from a bare `Intl.DateTimeFormat()`.
 * Undefined off the client (SSR, tests without a navigator), i.e. the runtime's
 * own default.
 */
export const viewerLocale = (): string | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator.language || undefined;

// A missing or unparseable input renders as `EMPTY_VALUE`. `Intl.DateTimeFormat.format`
// throws `RangeError: Invalid time value` on an invalid Date, so every formatter
// here guards first — callers can pass raw API values without a per-call check.

const dateFmt = new Intl.DateTimeFormat(viewerLocale(), { dateStyle: 'short' });
const timeFmt = new Intl.DateTimeFormat(viewerLocale(), { timeStyle: 'short' });
const timeWithSecondsFmt = new Intl.DateTimeFormat(viewerLocale(), { timeStyle: 'medium' });

const format = (input: DateInput | null | undefined, fmt: Intl.DateTimeFormat): string => {
  const date = toValidDate(input);
  return date ? fmt.format(date) : EMPTY_VALUE;
};

export const formatDate = (input: DateInput | null | undefined): string => format(input, dateFmt);

/**
 * An instant's UTC day as `yyyy-MM-dd`, for a date read beside a `Date` scalar printed as it came: a token pack's
 * purchase next to its `validUntil`, both on the UTC calendar billing dates them on.
 */
export const formatUtcDay = (input: DateInput | null | undefined): string =>
  toValidDate(input)?.toISOString().slice(0, 10) ?? EMPTY_VALUE;

export const formatTime = (input: DateInput | null | undefined): string => format(input, timeFmt);

export const formatTimeWithSeconds = (input: DateInput | null | undefined): string => format(input, timeWithSecondsFmt);

export const formatDateTime = (input: DateInput | null | undefined): string => {
  const date = toValidDate(input);
  return date ? `${dateFmt.format(date)} ${timeFmt.format(date)}` : EMPTY_VALUE;
};

export const viewerTimeZone = (): string => new Intl.DateTimeFormat().resolvedOptions().timeZone;

// Null for a missing zone or one the runtime does not know — `Intl` throws on those.
// Written in the viewer's locale unless the caller pins one.
function inZone(timeZone: string | null | undefined, options: Intl.DateTimeFormatOptions, locale?: string) {
  try {
    return timeZone ? new Intl.DateTimeFormat(locale ?? viewerLocale(), { ...options, timeZone }) : null;
  } catch {
    return null;
  }
}

export const formatDateTimeInZone = (
  input: DateInput | null | undefined,
  timeZone: string | null | undefined,
): string => {
  const date = toValidDate(input);
  const day = inZone(timeZone, { dateStyle: 'short' });
  const time = inZone(timeZone, { timeStyle: 'short' });
  return date && day && time ? `${day.format(date)} ${time.format(date)}` : EMPTY_VALUE;
};

/**
 * A moment on the DEVICE's clock — for events the device itself timestamps
 * (boot, restart, enrolment), which are read as "when did this happen there".
 * The zone is named after the time (`19/10/2026 09:05 AEDT`, or `GMT+11` where
 * the locale has no abbreviation for it) so the value is not mistaken for the
 * viewer's own clock. Falls back to the viewer's clock, unlabelled, when the
 * device's zone is unknown or unresolvable — a wrong zone must not blank a row.
 */
export const formatDateTimeOnDevice = (
  input: DateInput | null | undefined,
  deviceTimeZone: string | null | undefined,
): string => {
  const date = toValidDate(input);
  if (!date) return EMPTY_VALUE;
  const zoneName = inZone(deviceTimeZone, { timeZoneName: 'short' })
    ?.formatToParts(date)
    .find(part => part.type === 'timeZoneName')?.value;
  const onDevice = zoneName ? formatDateTimeInZone(date, deviceTimeZone) : EMPTY_VALUE;
  return onDevice === EMPTY_VALUE ? formatDateTime(date) : `${onDevice} ${zoneName}`;
};

/**
 * The value of an `<input type="datetime-local">` for an instant: the viewer's
 * wall-clock time, which is what the field shows and parses back. Slicing
 * `toISOString()` instead puts the UTC clock in the field, hours off for
 * everyone outside UTC. Empty for a missing or unparseable instant.
 */
export const toDateTimeLocalValue = (input: DateInput | null | undefined): string => {
  const date = toValidDate(input);
  return date ? formatPattern(date, "yyyy-MM-dd'T'HH:mm") : '';
};

// Renamed by IANA; Chrome and agents on older tzdata still report the old id.
const RENAMED_CITIES: Record<string, string> = {
  Kiev: 'Kyiv',
  Calcutta: 'Kolkata',
  Saigon: 'Ho Chi Minh',
  Rangoon: 'Yangon',
  Katmandu: 'Kathmandu',
  Godthab: 'Nuuk',
  Faeroe: 'Faroe',
};

/** `(UTC+02:00) Kyiv`, with the offset the zone had at `at` — DST moves it. */
export const formatTimeZone = (timeZone: string | null | undefined, at: DateInput | null | undefined): string => {
  const fmt = inZone(timeZone, { timeZoneName: 'longOffset' }, 'en-US');
  if (!timeZone || !fmt) return EMPTY_VALUE;

  const offset = fmt.format(toValidDate(at) ?? new Date()).split('GMT')[1] || '+00:00';
  const [area, ...rest] = timeZone.split('/');
  const city = area === 'Etc' ? undefined : rest.pop();

  return city ? `(UTC${offset}) ${RENAMED_CITIES[city] ?? city.replace(/_/g, ' ')}` : `(UTC${offset})`;
};

// Fixed-width 24-hour time with milliseconds, so log lines align in a column.
const logTimeFmt = new Intl.DateTimeFormat(viewerLocale(), {
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
});

export const formatLogTime = (input: DateInput | null | undefined): string => format(input, logTimeFmt);
