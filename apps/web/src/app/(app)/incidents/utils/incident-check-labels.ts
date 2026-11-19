import {
  type InsightCheckParameterUnit,
  type InsightCheckPlatform,
  type InsightCheckScopeType,
  InsightThresholdDirection,
} from '@/generated/schema-enums';

export const INSIGHT_CHECK_PLATFORM_LABELS: Record<InsightCheckPlatform, string> = {
  WINDOWS: 'Windows',
  MACOS: 'macOS',
  ALL: 'All platforms',
};

/** A scope's kind as a word: the picker's options and the "from …" lines. */
export const INSIGHT_CHECK_SCOPE_LABELS: Record<InsightCheckScopeType, string> = {
  DEFAULT: 'Default',
  GLOBAL: 'All devices',
  TAG: 'Tag',
  CUSTOMER: 'Customer',
  DEVICE: 'Device',
};

/** `10%`, `30 days`, `1 day`, `40`. Without a unit, the bare number. */
export function formatParameterValue(value: number, unit: InsightCheckParameterUnit | string | null): string {
  switch (unit) {
    case 'PERCENT':
      return `${value}%`;
    case 'DAYS':
      return value === 1 ? '1 day' : `${value} days`;
    default:
      return String(value);
  }
}

/** The unit's suffix beside a number field: `%`, `days`, nothing for a count. */
export function parameterUnitSuffix(unit: InsightCheckParameterUnit | string): string | undefined {
  switch (unit) {
    case 'PERCENT':
      return '%';
    case 'DAYS':
      return 'days';
    default:
      return undefined;
  }
}

/** `Below 10%` / `Above 30 days`; the bare value where the API names no side (an old incident's threshold). */
export function formatThreshold(
  value: number,
  unit: InsightCheckParameterUnit | string | null,
  firesWhen: InsightThresholdDirection | string | null,
): string {
  const formatted = formatParameterValue(value, unit);
  if (firesWhen === InsightThresholdDirection.BELOW) return `Below ${formatted}`;
  if (firesWhen === InsightThresholdDirection.ABOVE) return `Above ${formatted}`;
  return formatted;
}
