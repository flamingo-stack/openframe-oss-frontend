// Value import: the generated module exports each enum as both a `const` and a
// `type` under the same name, so these stand in for hardcoded literals.
import { PrivilegeLevel, ScriptExecutionStatus } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { presentationFor } from '@/lib/exhaustive-map';

/**
 * Presentation helpers for script executions — shared by the Execution History
 * table and the single-execution details page so labels/variants stay in sync.
 */

export type TagVariant = 'success' | 'error' | 'warning' | 'grey';

interface ExecutionStatusPresentation {
  /** Human label (design: SUCCESS reads as "Completed"). */
  label: string;
  /** Tag color variant. */
  variant: TagVariant;
  /** Not a final state — the details page polls while an execution is in one. */
  inFlight: boolean;
}

/**
 * Every execution status, in one exhaustive table.
 *
 * Typed as `Record<ScriptExecutionStatus, …>` on purpose: when the backend adds
 * a status and `npm run fetch-schema && npm run generate-enums` widens the enum,
 * this object stops type-checking until the new value is given a label, a color
 * and a polling answer — instead of silently landing in a `default:` branch that
 * renders the raw `SOME_NEW_STATUS` in a grey tag.
 */
const EXECUTION_STATUS_PRESENTATION = {
  [ScriptExecutionStatus.QUEUED]: { label: 'Queued', variant: 'grey', inFlight: true },
  [ScriptExecutionStatus.RUNNING]: { label: 'Running', variant: 'warning', inFlight: true },
  [ScriptExecutionStatus.SUCCESS]: { label: 'Completed', variant: 'success', inFlight: false },
  [ScriptExecutionStatus.FAILED]: { label: 'Failed', variant: 'error', inFlight: false },
} satisfies Record<ScriptExecutionStatus, ExecutionStatusPresentation>;

/** Human label for an execution status. */
export function executionStatusLabel(status: ScriptExecutionStatus | string | null | undefined): string {
  return presentationFor(EXECUTION_STATUS_PRESENTATION, status)?.label ?? (status ? String(status) : EMPTY_VALUE);
}

/** Tag color variant for an execution status. */
export function executionStatusVariant(status: ScriptExecutionStatus | string | null | undefined): TagVariant {
  return presentationFor(EXECUTION_STATUS_PRESENTATION, status)?.variant ?? 'grey';
}

/** Whether an execution is still on its way to a final status (queued or running). */
export function isExecutionInFlight(status: ScriptExecutionStatus | string | null | undefined): boolean {
  return presentationFor(EXECUTION_STATUS_PRESENTATION, status)?.inFlight ?? false;
}

/**
 * Privilege levels, same exhaustive shape as the status table above (ADMIN runs
 * elevated as the system account; ELEVATED_USER is the logged-on Windows user
 * with the UAC token).
 */
const PRIVILEGE_LEVEL_LABELS = {
  [PrivilegeLevel.ADMIN]: 'System',
  [PrivilegeLevel.USER]: 'User',
  [PrivilegeLevel.ELEVATED_USER]: 'Elevated User',
} satisfies Record<PrivilegeLevel, string>;

/** Human label for a privilege level. */
export function privilegeLevelLabel(level: PrivilegeLevel | string | null | undefined): string {
  return presentationFor(PRIVILEGE_LEVEL_LABELS, level) ?? (level ? String(level) : EMPTY_VALUE);
}

interface InitiatorLike {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

/** Full name of an execution initiator (falls back to email, then "Unknown"). */
export function initiatorName(user: InitiatorLike | null | undefined): string {
  if (!user) return 'Unknown';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.email || 'Unknown';
}

/** Up-to-two-letter initials for an initiator avatar fallback. */
export function initiatorInitials(user: InitiatorLike | null | undefined): string {
  if (!user) return 'UN';
  const first = user.firstName?.trim()?.[0];
  const last = user.lastName?.trim()?.[0];
  if (first || last) return `${first ?? ''}${last ?? ''}`.toUpperCase();
  return (user.email?.trim()?.slice(0, 2) || 'UN').toUpperCase();
}

interface ExecutionOutput {
  stdout?: string | null;
  stderr?: string | null;
  error?: string | null;
}

/**
 * Everything an execution printed: stdout, then stderr, then the dispatch error
 * — all three, not the first non-empty one, since a failed run often prints
 * progress to stdout and the reason to stderr. Empty when it printed nothing.
 */
export function executionOutput({ stdout, stderr, error }: ExecutionOutput): string {
  return [stdout, stderr, error].filter(Boolean).join('\n\n');
}
