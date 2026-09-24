import type { DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { format, subDays } from 'date-fns';
import { dateRangeToInstantBounds } from '@/lib/date-filter-params';

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

/** The largest value `new Date(ms)` still represents; past it every format throws. */
const MAX_TIMESTAMP_MS = 8.64e15;

/**
 * The anchor a `?refresh=` stamp moves the window to, or null to keep it: only a
 * newer, representable instant counts, so Back to an older stamp reloads nothing.
 */
export function adoptRefreshStamp(stamp: string, anchorMs: number): number | null {
  const stamped = Number(stamp);
  return Number.isFinite(stamped) && stamped > anchorMs && stamped <= MAX_TIMESTAMP_MS ? stamped : null;
}

/** Lower bound for a preset, computed once per list so the window does not slide on every render. */
export function presetToFromInstant(preset: DeviceLogRangeWindow, now = new Date()): string {
  return new Date(now.getTime() - PRESET_DURATION_MS[preset]).toISOString();
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

/** The instant's whole seconds as epoch ms, and its 0–9 digit fraction verbatim. */
function splitInstant(instant: string): { millis: number; fraction: string } | null {
  const match = INSTANT_PATTERN.exec(instant);
  if (!match) return null;
  const millis = Date.parse(`${match[1]}Z`);
  return Number.isNaN(millis) ? null : { millis, fraction: (match[2] ?? '').padEnd(9, '0') };
}

/**
 * The row's time column (spec §4) in the viewer's zone, like every time in the
 * app. The fraction is copied from the wire padded to nanoseconds — `Date` keeps
 * only milliseconds, and an unpadded column is ragged. Unparseable passes through.
 */
export function formatDeviceLogTime(instant: string): string {
  const parts = splitInstant(instant);
  return parts ? `${format(parts.millis, 'HH:mm:ss')}.${parts.fraction}` : instant;
}

/** The local day a line belongs to — the grouping key for the separators. */
export function deviceLogDay(instant: string): string {
  const parts = splitInstant(instant);
  return parts ? format(parts.millis, 'yyyy-MM-dd') : instant.slice(0, 10);
}

/** `23 SEP 2026` for the separator between days. */
export function formatDeviceLogDay(instant: string): string {
  const parts = splitInstant(instant);
  return parts ? format(parts.millis, 'dd MMM yyyy').toUpperCase() : instant;
}

/** The zone the times are shown in, as of that instant (`GMT+3`, `EDT`), so DST shows. */
export function formatDeviceLogZone(instant: string): string {
  const parts = splitInstant(instant);
  const zone = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(parts?.millis ?? Date.now())
    .find(part => part.type === 'timeZoneName');
  return zone?.value ?? '';
}

/**
 * The custom range's instants via the shared local-day helper. A lone end day
 * stands for itself, a reversed pair is put in order, and a hand-edited URL
 * wider than the API allows is clamped to its last 30 days.
 */
export function deviceLogCustomBounds(range: DateRange | undefined): { from?: string; to?: string } {
  const first = range?.from ?? range?.to;
  const last = range?.to ?? range?.from;
  if (!first || !last) return {};
  const [lower, upper] = first <= last ? [first, last] : [last, first];
  const earliest = subDays(upper, MAX_DEVICE_LOG_RANGE_DAYS - 1);
  return dateRangeToInstantBounds({ from: lower < earliest ? earliest : lower, to: upper });
}
