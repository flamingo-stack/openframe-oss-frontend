import { differenceInMilliseconds } from 'date-fns';

export const DEVICE_LOG_RANGE_PRESETS = ['1h', '24h', '7d', 'custom'] as const;
export type DeviceLogRangePreset = (typeof DEVICE_LOG_RANGE_PRESETS)[number];

export const DEVICE_LOG_RANGE_LABELS: Record<DeviceLogRangePreset, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  custom: 'Custom range',
};

export type DeviceLogRangeWindow = Exclude<DeviceLogRangePreset, 'custom'>;

/** 24 h rather than the API's 7 d so the first page of a busy device stays small. */
export const DEFAULT_DEVICE_LOG_RANGE: DeviceLogRangeWindow = '24h';

/** The API rejects wider ranges with VALIDATION_ERROR; the picker never offers one. */
export const MAX_DEVICE_LOG_RANGE_DAYS = 30;

const HOUR_MS = 60 * 60 * 1000;
const PRESET_DURATION_MS: Record<DeviceLogRangeWindow, number> = {
  '1h': HOUR_MS,
  '24h': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
};

export function isDeviceLogRangePreset(value: string): value is DeviceLogRangePreset {
  return (DEVICE_LOG_RANGE_PRESETS as readonly string[]).includes(value);
}

/** Lower bound for a preset, computed once per list so the window does not slide on every render. */
export function presetToFromInstant(preset: DeviceLogRangeWindow, now = new Date()): string {
  return new Date(now.getTime() - PRESET_DURATION_MS[preset]).toISOString();
}

export function isRangeWithinLimit(from: Date, to: Date): boolean {
  return differenceInMilliseconds(to, from) <= MAX_DEVICE_LOG_RANGE_DAYS * 24 * HOUR_MS;
}

const INSTANT_PATTERN = /^(.+T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * Instant strings trim the fraction to 3, 6 or 9 digits, so "…34.486Z" sorts
 * after "…34.486000035Z" as text and `Date` keeps only milliseconds. Compare as
 * nanoseconds instead.
 */
export function instantToNanos(instant: string): bigint {
  const match = INSTANT_PATTERN.exec(instant);
  if (!match) {
    throw new Error(`Unexpected timestamp: ${instant}`);
  }
  const millis = Date.parse(`${match[1]}Z`);
  if (Number.isNaN(millis)) {
    throw new Error(`Unexpected timestamp: ${instant}`);
  }
  // `BigInt()` calls, not `123n` literals: the TS target predates ES2020 syntax.
  return BigInt(millis / 1000) * BigInt(1_000_000_000) + BigInt((match[2] ?? '').padEnd(9, '0'));
}

/**
 * Strictly-newer test for the auto-update merge (`from` is inclusive, so the
 * newest known line always comes back). A timestamp the pattern does not
 * recognise falls back to a text comparison rather than dropping the line.
 */
export function isInstantAfter(candidate: string, reference: string): boolean {
  try {
    return instantToNanos(candidate) > instantToNanos(reference);
  } catch {
    return candidate > reference;
  }
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * The row's time column (spec §4). UTC like the instant itself and like
 * `agent_ts` beside it — a log viewer that mixes zones is a bug factory.
 * Unparseable values pass through whole rather than losing data.
 */
export function formatDeviceLogTime(instant: string): string {
  const match = INSTANT_PATTERN.exec(instant);
  if (!match) return instant;
  const time = match[1].slice(match[1].indexOf('T') + 1);
  // Padded to nanoseconds because the API trims the fraction to 3, 6 or 9
  // digits: unpadded, the column is ragged. `.036` IS `.036000000`.
  return `${time}.${(match[2] ?? '').padEnd(9, '0')}`;
}

/** Day the row belongs to, in UTC — the grouping key for the separators. */
export function deviceLogDay(instant: string): string {
  return instant.slice(0, 10);
}

/** `23 SEP 2026` for the separator between days. */
export function formatDeviceLogDay(instant: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(instant);
  if (!match) return instant;
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${match[3]} ${month} ${match[1]}`;
}

/**
 * Inclusive UTC bounds for the day params the custom picker writes. Not the
 * shared local-day helper: every timestamp on this tab is rendered and grouped
 * in UTC, so local bounds would filter a different day than the one shown.
 */
export function deviceLogDayBounds(fromDay: string, toDay: string): { from?: string; to?: string } {
  // Symmetric fallback: a URL carrying only `to` used to drop the whole range
  // and land on the default window without saying so.
  const lower = fromDay || toDay;
  const upper = toDay || fromDay;
  if (!lower || !upper) return { from: undefined, to: undefined };
  const to = new Date(`${upper}T23:59:59.999Z`);
  const from = new Date(`${lower}T00:00:00.000Z`);
  // A hand-edited day param must never reach `toISOString()`, which throws on an
  // invalid date — and this runs above the tab's error boundary.
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { from: undefined, to: undefined };
  // The picker cannot offer a wider range, but a hand-edited URL can, and the
  // API answers VALIDATION_ERROR — clamp instead of sending a doomed request.
  // `+1ms` lands exactly on a UTC day start, so the clamp stays day-aligned.
  const capped = isRangeWithinLimit(from, to)
    ? from
    : new Date(to.getTime() - MAX_DEVICE_LOG_RANGE_DAYS * 24 * HOUR_MS + 1);
  return { from: capped.toISOString(), to: to.toISOString() };
}
