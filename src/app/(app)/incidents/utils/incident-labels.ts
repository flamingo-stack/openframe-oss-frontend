import { type InsightSeverity, InsightStatus, type InsightType } from '@/generated/schema-enums';

export const INCIDENT_TYPE_LABELS: Record<InsightType, string> = {
  SECURITY: 'Security',
  IT: 'IT',
};

export const INCIDENT_SEVERITY_LABELS: Record<InsightSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

export const INCIDENT_STATUS_LABELS: Record<InsightStatus, string> = {
  NEW: 'New',
  ACKNOWLEDGED: 'Acknowledged',
  SNOOZED: 'Snoozed',
  RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
};

/**
 * Label for an enum value read out of a Relay artifact, whose type is widened
 * with `"%future added value"`: a member this build does not know shows its
 * raw value rather than nothing.
 */
export function labelOf(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/** How a transition INTO each status is named: the menu item, and the past tense the toast uses. */
export const INCIDENT_TRANSITION_ACTIONS: Record<InsightStatus, { label: string; done: string }> = {
  NEW: { label: 'Reopen', done: 'reopened' },
  ACKNOWLEDGED: { label: 'Acknowledge', done: 'acknowledged' },
  SNOOZED: { label: 'Snooze', done: 'snoozed' },
  RESOLVED: { label: 'Resolve', done: 'resolved' },
  ARCHIVED: { label: 'Archive', done: 'archived' },
};

/**
 * What the list shows when no status filter is chosen: everything still in
 * play. ARCHIVED is filed away by definition and only appears when asked for.
 */
export const WORKING_SET_STATUSES: readonly InsightStatus[] = [
  InsightStatus.NEW,
  InsightStatus.ACKNOWLEDGED,
  InsightStatus.SNOOZED,
  InsightStatus.RESOLVED,
];

/** Keeps only the members of `values` that are values of the enum object `of` — URL params are untyped. */
export function enumMembers<T extends string>(values: readonly string[], enumObject: Record<string, T>): T[] {
  const members = new Set<string>(Object.values(enumObject));
  return values.filter((value): value is T => members.has(value));
}
