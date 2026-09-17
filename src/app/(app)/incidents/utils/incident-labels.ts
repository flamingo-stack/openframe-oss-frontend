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

/**
 * Which statuses an incident may move to from each status — a mirror of the
 * backend's `InsightStatusTransitionValidator`, so the UI offers only actions
 * the server will accept. Archiving is reachable only from RESOLVED: an
 * incident is filed away after it was dealt with, never instead of it.
 */
const INCIDENT_TRANSITIONS: Record<InsightStatus, readonly InsightStatus[]> = {
  NEW: [InsightStatus.ACKNOWLEDGED, InsightStatus.SNOOZED, InsightStatus.RESOLVED],
  ACKNOWLEDGED: [InsightStatus.SNOOZED, InsightStatus.RESOLVED],
  SNOOZED: [InsightStatus.ACKNOWLEDGED, InsightStatus.RESOLVED],
  RESOLVED: [InsightStatus.ARCHIVED, InsightStatus.NEW],
  ARCHIVED: [InsightStatus.NEW],
};

/** Transitions offered from `status`; none for a status this build does not know (`"%future added value"`). */
export function transitionsFrom(status: string): readonly InsightStatus[] {
  const transitions: Record<string, readonly InsightStatus[]> = INCIDENT_TRANSITIONS;
  return transitions[status] ?? [];
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
