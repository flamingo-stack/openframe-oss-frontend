import type { DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { startOfDay, subDays } from 'date-fns';
import { dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { toValidDate } from '@/lib/format-date';

export const DEVICE_LOG_RANGES = ['1h', '24h', '7d', 'custom'] as const;
export type DeviceLogRange = (typeof DEVICE_LOG_RANGES)[number];

export const DEVICE_LOG_RANGE_LABELS: Record<DeviceLogRange, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  custom: 'Custom range',
};

export const DEFAULT_DEVICE_LOG_RANGE: Exclude<DeviceLogRange, 'custom'> = '24h';

/** `DeviceLogFilterInput`: `from`..`to` may span at most 30 days. */
const MAX_RANGE_DAYS = 30;

const HOUR_MS = 60 * 60 * 1000;
const PRESET_MS: Record<Exclude<DeviceLogRange, 'custom'>, number> = {
  '1h': HOUR_MS,
  '24h': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
};

export const isDeviceLogRange = (value: string): value is DeviceLogRange =>
  (DEVICE_LOG_RANGES as readonly string[]).includes(value);

/** A preset counts back from `anchorMs`; custom covers the picked local days, or the default preset until days are picked. */
export function deviceLogRangeBounds(
  range: DeviceLogRange,
  custom: DateRange | undefined,
  anchorMs: number,
): { from?: string; to?: string } {
  if (range === 'custom' && custom) return dateRangeToInstantBounds(custom);
  const preset = range === 'custom' ? DEFAULT_DEVICE_LOG_RANGE : range;
  return { from: new Date(anchorMs - PRESET_MS[preset]).toISOString() };
}

/** The custom picker's selectable days: the 30 ending on the anchor's. */
export function deviceLogPickerBounds(anchorMs: number): { fromDate: Date; toDate: Date } {
  const today = new Date(anchorMs);
  return { fromDate: startOfDay(subDays(today, MAX_RANGE_DAYS - 1)), toDate: today };
}

/** An `Instant` as a `Date`. Java prints up to nine fraction digits; `Date` parses three. */
export function instantToDate(instant: string): Date | null {
  return toValidDate(instant.replace(/(\.\d{3})\d+Z$/, '$1Z'));
}

export interface DeviceLogDayGroup<T> {
  key: string;
  date: Date | null;
  rows: { key: string; item: T }[];
}

/**
 * Consecutive lines of one local day, in list order. Row keys are the cursors,
 * suffixed when lines share one (the cursor is the line's timestamp).
 */
export function groupByLocalDay<T>(
  items: readonly T[],
  instantOf: (item: T) => string,
  cursorOf: (item: T) => string,
): DeviceLogDayGroup<T>[] {
  const groups: DeviceLogDayGroup<T>[] = [];
  const seen = new Map<string, number>();
  for (const item of items) {
    const instant = instantOf(item);
    const date = instantToDate(instant);
    const dayKey = date ? toDayParam(date) : instant;
    const cursor = cursorOf(item);
    const repeat = seen.get(cursor) ?? 0;
    seen.set(cursor, repeat + 1);
    const row = { key: repeat === 0 ? cursor : `${cursor}#${repeat}`, item };
    const last = groups[groups.length - 1];
    if (last && last.key === dayKey) last.rows.push(row);
    else groups.push({ key: dayKey, date, rows: [row] });
  }
  return groups;
}
