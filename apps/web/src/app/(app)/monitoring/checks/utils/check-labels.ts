import {
  type InsightCheckParameterUnit,
  type InsightCheckPlatform,
  InsightCheckScopeType,
  InsightThresholdDirection,
} from '@/generated/schema-enums';
import { pluralize } from '@/lib/pluralize';
import type { Check, CheckOverride, OverrideScopeType } from './check-transform';

export const INSIGHT_CHECK_PLATFORM_LABELS: Record<InsightCheckPlatform, string> = {
  WINDOWS: 'Windows',
  MACOS: 'macOS',
  ALL: 'All platforms',
};

/** What an exception applies to, as the Add Exception modal's picker and the table's filter name it. */
export const OVERRIDE_SCOPE_LABELS: Record<OverrideScopeType, string> = {
  CUSTOMER: 'Customer',
  TAG: 'Device Tag',
  DEVICE: 'Device',
};

/** The picked entity's field in the exception form, by kind: "Tag" under an Applies to of "Device Tag" (the design's). */
export const OVERRIDE_ENTITY_LABELS: Record<OverrideScopeType, string> = { ...OVERRIDE_SCOPE_LABELS, TAG: 'Tag' };

/** Where an incident's threshold came from, as its details say it ("Tag · kiosk", "Default · all devices"). */
export function thresholdScopeLabel(scopeType: InsightCheckScopeType | string, scopeName: string | null): string {
  switch (scopeType) {
    case InsightCheckScopeType.DEFAULT:
    case InsightCheckScopeType.GLOBAL:
      return 'Default · all devices';
    case InsightCheckScopeType.CUSTOMER:
      return scopeName ? `Customer · ${scopeName}` : 'Customer';
    case InsightCheckScopeType.TAG:
      return scopeName ? `Tag · ${scopeName}` : 'Tag';
    case InsightCheckScopeType.DEVICE:
      return scopeName ? `Device · ${scopeName}` : 'Device';
    default:
      return scopeName ?? scopeType;
  }
}

/** `10%`, `30 days`, `1 day`, `40`. Without a unit, the bare number. */
export function formatParameterValue(value: number, unit: InsightCheckParameterUnit | string | null): string {
  switch (unit) {
    case 'PERCENT':
      return `${value}%`;
    case 'DAYS':
      return pluralize(value, 'day');
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

/** Several thresholds as one phrase: `Below 80% or above 1000`. */
export function joinThresholds(thresholds: readonly string[]): string {
  return thresholds.map((threshold, index) => (index === 0 ? threshold : lowerFirst(threshold))).join(' or ');
}

/** A phrase made to start a sentence, put inside one: `Above 30 days` → `above 30 days`. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** What an on/off check (no thresholds) shows where a threshold would be. */
export const NO_THRESHOLD_LABEL = 'On / off';

/** The check's default for every device without an exception: `Below 10%`, `On / off`. */
export function formatDefaultThreshold(check: Check): string {
  if (check.parameters.length === 0) return NO_THRESHOLD_LABEL;
  return joinThresholds(
    check.parameters.map(parameter => formatThreshold(parameter.value, parameter.unit, parameter.firesWhen)),
  );
}

/**
 * An exception's Threshold cell: what it stores, in the check's words. Turned off, it is "Turned off" (its
 * thresholds no longer matter); on with no threshold of its own, "On".
 */
export function formatOverrideThreshold(check: Check, override: CheckOverride): string {
  if (override.enabled === false) return 'Turned off';
  const stored = check.parameters.flatMap(parameter => {
    const value = override.parameters[parameter.parameter];
    return value === undefined ? [] : [formatThreshold(value, parameter.unit, parameter.firesWhen)];
  });
  if (stored.length > 0) return joinThresholds(stored);
  return override.enabled === true ? 'On' : NO_THRESHOLD_LABEL;
}

/** `1 h`, `15 min`, `2 d`: how often a check runs, as its page says it under "Runs every". */
export function formatRunsEvery(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} d`;
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}
