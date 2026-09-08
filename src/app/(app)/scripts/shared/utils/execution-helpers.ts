// Value import: the generated module exports each enum as both a `const` and a
// `type` under the same name, so these stand in for hardcoded literals.
import { PrivilegeLevel, ScriptExecutionStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { formatDate, formatTime } from '@/lib/format-date';

/** "date, time" in the user's local format (e.g. "6/26/26, 2:31 PM"). */
export function formatExecutionTimestamp(input: string | number | Date | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  return `${formatDate(date)}, ${formatTime(date)}`;
}

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
  return presentationFor(EXECUTION_STATUS_PRESENTATION, status)?.label ?? (status ? String(status) : '—');
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
 * elevated as the system account).
 */
const PRIVILEGE_LEVEL_LABELS = {
  [PrivilegeLevel.ADMIN]: 'System',
  [PrivilegeLevel.USER]: 'User',
} satisfies Record<PrivilegeLevel, string>;

/** Human label for a privilege level. */
export function privilegeLevelLabel(level: PrivilegeLevel | string | null | undefined): string {
  return presentationFor(PRIVILEGE_LEVEL_LABELS, level) ?? (level ? String(level) : '—');
}

interface MachineLike {
  machineId?: string | null;
  hostname?: string | null;
  displayName?: string | null;
  organization?: { name?: string | null } | null;
}

/** Best display name for a machine (displayName → hostname → machineId). */
export function machineLabel(machine: MachineLike | null | undefined): string {
  return machine?.displayName || machine?.hostname || machine?.machineId || '—';
}

/** Organization name for a machine, or empty string. */
export function organizationLabel(machine: MachineLike | null | undefined): string {
  return machine?.organization?.name ?? '';
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

interface ExecutionResultLike {
  stdout?: string | null;
  stderr?: string | null;
  error?: string | null;
}

/** Combined result text shown in the table / details (stdout → stderr → error). */
export function executionResultText(node: ExecutionResultLike | null | undefined): string {
  return node?.stdout || node?.stderr || node?.error || '';
}
