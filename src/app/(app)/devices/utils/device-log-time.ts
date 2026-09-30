import type { DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { startOfDay, subDays } from 'date-fns';
import { dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { toValidDate } from '@/lib/format-date';

// --- The range control ---

export const DEVICE_LOG_RANGES = ['1h', '24h', '7d', 'custom'] as const;
export type DeviceLogRange = (typeof DEVICE_LOG_RANGES)[number];
type DeviceLogPreset = Exclude<DeviceLogRange, 'custom'>;

export const DEVICE_LOG_RANGE_LABELS: Record<DeviceLogRange, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  custom: 'Custom range',
};

export const DEFAULT_DEVICE_LOG_RANGE: DeviceLogPreset = '24h';

/** `DeviceLogFilterInput`: `from`..`to` may span at most 30 days (`DeviceLogService.MAX_RANGE`). */
const MAX_RANGE_DAYS = 30;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PRESET_MS: Record<DeviceLogPreset, number> = {
  '1h': HOUR_MS,
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
};

export function isDeviceLogRange(value: string): value is DeviceLogRange {
  return (DEVICE_LOG_RANGES as readonly string[]).includes(value);
}

/** `from`/`to` for the filter: a preset counts back from the anchor; custom covers the picked local days. */
export function deviceLogRangeBounds(
  range: DeviceLogRange,
  custom: DateRange | undefined,
  anchorMs: number,
): { from?: string; to?: string } {
  if (range !== 'custom') return presetBounds(range, anchorMs);
  // Custom with no days picked yet reads as the default preset.
  return custom ? dateRangeToInstantBounds(custom) : presetBounds(DEFAULT_DEVICE_LOG_RANGE, anchorMs);
}

function presetBounds(preset: DeviceLogPreset, anchorMs: number): { from: string } {
  return { from: new Date(anchorMs - PRESET_MS[preset]).toISOString() };
}

/** The custom picker's selectable days: the 30 ending on the anchor's. */
export function deviceLogPickerBounds(anchorMs: number): { fromDate: Date; toDate: Date } {
  const today = new Date(anchorMs);
  return { fromDate: startOfDay(subDays(today, MAX_RANGE_DAYS - 1)), toDate: today };
}

// --- The lines ---

/** Java prints an `Instant` with up to nine fraction digits; `Date` parses three. */
const NANOS_PAST_MILLIS = /(\.\d{3})\d+Z$/;

export function instantToDate(instant: string): Date | null {
  return toValidDate(instant.replace(NANOS_PAST_MILLIS, '$1Z'));
}

/** The local day a line belongs to; an unreadable instant is its own day. */
function localDayOf(instant: string): string {
  const date = instantToDate(instant);
  return date ? toDayParam(date) : instant;
}

/** The cursor is the line's timestamp, so lines sharing one get a suffix to stay unique as React keys. */
function uniqueRowKeys(cursors: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return cursors.map(cursor => {
    const repeat = seen.get(cursor) ?? 0;
    seen.set(cursor, repeat + 1);
    return repeat === 0 ? cursor : `${cursor}#${repeat}`;
  });
}

export interface DeviceLogDayGroup<T> {
  key: string;
  date: Date | null;
  rows: { key: string; item: T }[];
}

/** Consecutive lines of one local day, in list order. */
export function groupByLocalDay<T>(
  items: readonly T[],
  instantOf: (item: T) => string,
  cursorOf: (item: T) => string,
): DeviceLogDayGroup<T>[] {
  const keys = uniqueRowKeys(items.map(cursorOf));
  const groups: DeviceLogDayGroup<T>[] = [];

  items.forEach((item, index) => {
    const instant = instantOf(item);
    const day = localDayOf(instant);
    const row = { key: keys[index], item };
    const current = groups.at(-1);
    if (current?.key === day) current.rows.push(row);
    else groups.push({ key: day, date: instantToDate(instant), rows: [row] });
  });

  return groups;
}
