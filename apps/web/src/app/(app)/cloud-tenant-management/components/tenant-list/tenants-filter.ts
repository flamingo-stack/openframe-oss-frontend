import type { TenantsTableFilterColumn } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { SortDirection as ModalSortDirection } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type {
  DirectoryConnectionFilterInput,
  DirectoryConnectionOrderInput,
} from '@/__generated__/tenantsTableQuery.graphql';
import {
  type DirectoryAccessState,
  DirectoryConnectionSortField,
  type DirectoryLicenseFilter,
  type DirectoryProvider,
  SortDirection,
} from '@/generated/schema-enums';

/** The funnels' ticks, by column id; the Tenant funnel offers providers. */
export type TenantSelections = Record<TenantsTableFilterColumn, string[]>;

/** The funnels as the query takes them; null when none is ticked, so an unfiltered list reads as one. */
export function toTenantFilter({
  tenant,
  customer,
  licenses,
  access,
}: TenantSelections): DirectoryConnectionFilterInput | null {
  const filter: DirectoryConnectionFilterInput = {
    ...(tenant.length > 0 && { providers: tenant as DirectoryProvider[] }),
    ...(customer.length > 0 && { organizationIds: customer }),
    ...(licenses.length > 0 && { licenses: licenses as DirectoryLicenseFilter[] }),
    ...(access.length > 0 && { accessStates: access as DirectoryAccessState[] }),
  };
  return Object.keys(filter).length > 0 ? filter : null;
}

/**
 * What the list sorts by (brief: name, users, last read). Not unattributed: most tenants have none. Not unused seats:
 * Google has no purchased total, and unused seats of two SKUs are not the same money.
 */
export const TENANT_SORT_COLUMNS = [
  { key: DirectoryConnectionSortField.NAME, label: 'Name' },
  { key: DirectoryConnectionSortField.USERS, label: 'Users' },
  { key: DirectoryConnectionSortField.LAST_READ, label: 'Last read' },
];

const isSortField = (value: string): value is DirectoryConnectionSortField =>
  TENANT_SORT_COLUMNS.some(({ key }) => key === value);

/** The sort as the query takes it; null is the server's default, by name. */
export function toTenantOrderBy(sortBy: string, direction: string): DirectoryConnectionOrderInput | null {
  if (!isSortField(sortBy)) return null;
  return { field: sortBy, direction: direction === 'desc' ? SortDirection.DESC : SortDirection.ASC };
}

export function tenantSortDirection(direction: string): ModalSortDirection {
  return direction === 'desc' ? 'desc' : 'asc';
}
