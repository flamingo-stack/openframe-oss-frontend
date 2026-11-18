import {
  type InsightCheckParameterUnit,
  type InsightCheckPlatform,
  type InsightCheckScopeType,
  InsightKind,
} from '@/generated/schema-enums';

/**
 * A check's name, by the kind it opens. The API names a check only by its key
 * (`resource-win-disk-low`) and its kind; two checks share a kind across platforms
 * (FIREWALL_OFF, DISK_NOT_ENCRYPTED), which the platform column tells apart.
 */
export const INSIGHT_KIND_LABELS: Record<InsightKind, string> = {
  [InsightKind.ANTIVIRUS_BAD]: 'Antivirus off or out of date',
  [InsightKind.AUTOLOGON_ENABLED]: 'Automatic sign-in enabled',
  [InsightKind.BATTERY_WORN]: 'Battery worn out',
  [InsightKind.DISK_NOT_ENCRYPTED]: 'Disk not encrypted',
  [InsightKind.DISK_SPACE_LOW]: 'Low disk space',
  [InsightKind.FIREWALL_OFF]: 'Firewall off',
  [InsightKind.GATEKEEPER_OFF]: 'Gatekeeper off',
  [InsightKind.MEMORY_PRESSURE]: 'Memory pressure',
  [InsightKind.PATCHING_DISABLED]: 'Update service disabled',
  [InsightKind.RDP_ENABLED]: 'Remote Desktop enabled',
  [InsightKind.RECENT_CRASHES]: 'Recent crashes',
  [InsightKind.REMOTE_LOGIN_ENABLED]: 'Remote Login enabled',
  [InsightKind.SIP_OFF]: 'System Integrity Protection off',
  [InsightKind.SLOW_BOOT]: 'Slow startup',
  [InsightKind.STALE_UPTIME]: 'Not restarted for too long',
  [InsightKind.UNSIGNED_BINARY]: 'Unsigned binary',
};

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

/** Which side of the threshold fires: free space BELOW 10%, uptime ABOVE 30 days. */
export type ThresholdComparison = 'below' | 'above';

interface ParameterPresentation {
  label: string;
  comparison: ThresholdComparison;
  /** The unit, for an incident's threshold: `InsightThreshold` carries none. A check's parameter carries its own. */
  unit: InsightCheckParameterUnit;
}

/**
 * How each threshold reads. The API gives a parameter's key, unit and bounds but neither a name
 * nor which side of it fires (the backend knows it as the parameter's "stricter" direction), so
 * the five built-in parameters are named here; an unknown one shows its key with no direction.
 * Delete this table when the API names its parameters.
 */
const PARAMETER_PRESENTATION: Readonly<Record<string, ParameterPresentation>> = {
  freePercent: { label: 'Free disk space', comparison: 'below', unit: 'PERCENT' },
  minHealthPercent: { label: 'Battery health', comparison: 'below', unit: 'PERCENT' },
  maxCycles: { label: 'Charge cycles', comparison: 'above', unit: 'COUNT' },
  maxStartupItems: { label: 'Apps launched at sign-in', comparison: 'above', unit: 'COUNT' },
  maxDays: { label: 'Days since restart', comparison: 'above', unit: 'DAYS' },
};

export function parameterPresentation(parameter: string): {
  label: string;
  comparison: ThresholdComparison | null;
  unit: InsightCheckParameterUnit | null;
} {
  return PARAMETER_PRESENTATION[parameter] ?? { label: parameter, comparison: null, unit: null };
}

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

/** `Below 10%` / `Above 30 days` / `40` (a parameter this build cannot name a side for). */
export function formatThreshold(
  value: number,
  unit: InsightCheckParameterUnit | string | null,
  comparison: ThresholdComparison | null,
): string {
  const formatted = formatParameterValue(value, unit);
  if (comparison === 'below') return `Below ${formatted}`;
  if (comparison === 'above') return `Above ${formatted}`;
  return formatted;
}
