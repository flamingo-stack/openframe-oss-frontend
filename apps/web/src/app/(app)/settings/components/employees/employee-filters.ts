import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, readInlineData } from 'react-relay';
import type { employeeFilters_invitationFilters$key } from '@/__generated__/employeeFilters_invitationFilters.graphql';
import type { employeeFilters_userFilters$key } from '@/__generated__/employeeFilters_userFilters.graphql';
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

/** What the ROLE and STATUS headers offer, keyed like {@link EmployeeSelections}. */
export interface EmployeeFilterOptions {
  roles: DataTableFilterOption[];
  status: DataTableFilterOption[];
}

/** The funnels before their facets are read (the loading state's): no option known yet. */
export const NO_EMPLOYEE_FILTER_OPTIONS: EmployeeFilterOptions = { roles: [], status: [] };

// The funnels' server facets. Each value is counted under the search and the
// other funnel, not its own, so the numbers hold while ticking within one.
const userFiltersFragment = graphql`
  fragment employeeFilters_userFilters on UserFilters @inline {
    statuses {
      value
      count
    }
    roles {
      value
      count
    }
  }
`;

const invitationFiltersFragment = graphql`
  fragment employeeFilters_invitationFilters on InvitationFilters @inline {
    statuses {
      value
      count
    }
    roles {
      value
      count
    }
  }
`;

type Facet = ReadonlyArray<{ readonly value: string; readonly count: number }>;

/**
 * The values some row has; a ticked one stays at zero, so a search that empties
 * it does not take away the way to untick it.
 */
function toOptions(facet: Facet, selected: readonly string[], label: (value: string) => string) {
  return facet
    .filter(({ value, count }) => count > 0 || selected.includes(value))
    .map(({ value, count }) => ({ id: value, label: label(value), value, count }));
}

const roleLabel = (role: string) => role;

export function userFilterOptions(
  ref: employeeFilters_userFilters$key,
  selections: EmployeeSelections,
): EmployeeFilterOptions {
  const { statuses, roles } = readInlineData(userFiltersFragment, ref);
  return {
    roles: toOptions(roles, selections.roles, roleLabel),
    status: toOptions(statuses, selections.status, employeeStatusLabel),
  };
}

export function invitationFilterOptions(
  ref: employeeFilters_invitationFilters$key,
  selections: EmployeeSelections,
): EmployeeFilterOptions {
  const { statuses, roles } = readInlineData(invitationFiltersFragment, ref);
  return {
    roles: toOptions(roles, selections.roles, roleLabel),
    status: toOptions(statuses, selections.status, employeeStatusLabel),
  };
}

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
