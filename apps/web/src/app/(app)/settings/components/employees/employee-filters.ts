import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { InvitationFilterInput } from '@/__generated__/invitationsListTableQuery.graphql';
import type { UserFilterInput } from '@/__generated__/usersListTableQuery.graphql';
import { InvitationStatus, UserRole, UserStatus } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { employeeStatusLabel } from './employee-status-tag';

/**
 * The ROLE and STATUS funnels of either Employees table, keyed by column id —
 * the shape the URL keeps (`?roles=&status=`).
 */
export interface EmployeeSelections {
  roles: string[];
  status: string[];
}

/** What a tab switch writes: the funnels mean something else on the other tab. */
export const NO_EMPLOYEE_SELECTIONS: EmployeeSelections = { roles: [], status: [] };

function options(values: readonly string[], label: (value: string) => string): DataTableFilterOption[] {
  return values.map(value => ({ id: value, label: label(value), value }));
}

// Plain enums, not server facets: no counts to show (see DataTableFilterOption.count).
export const ROLE_FILTER_OPTIONS = options(Object.values(UserRole), role => role);
export const USER_STATUS_FILTER_OPTIONS = options(Object.values(UserStatus), employeeStatusLabel);
export const INVITATION_STATUS_FILTER_OPTIONS = options(Object.values(InvitationStatus), employeeStatusLabel);

/** The values of one funnel this build knows, so a hand-edited URL cannot send the server an unknown enum. */
function known<T extends string>(values: Record<string, T>, selected: readonly string[]): T[] {
  return selected.map(value => knownValue(values, value)).filter((value): value is T => value !== null);
}

/** The funnels as `users(filter:)` takes them — null when nothing is ticked. */
export function toUserFilter(selections: EmployeeSelections): UserFilterInput | null {
  const roles = known(UserRole, selections.roles);
  const statuses = known(UserStatus, selections.status);
  if (roles.length === 0 && statuses.length === 0) return null;
  return { ...(roles.length > 0 && { roles }), ...(statuses.length > 0 && { statuses }) };
}

/** The funnels as `invitations(filter:)` takes them — null when nothing is ticked. */
export function toInvitationFilter(selections: EmployeeSelections): InvitationFilterInput | null {
  const roles = known(UserRole, selections.roles);
  const statuses = known(InvitationStatus, selections.status);
  if (roles.length === 0 && statuses.length === 0) return null;
  return { ...(roles.length > 0 && { roles }), ...(statuses.length > 0 && { statuses }) };
}
