import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Employees page, shared by the users table, the
 * invitations block and the users skeleton — see `table-column-layout.ts` for
 * why this module is data-only.
 */
export const EMPLOYEES_COLUMNS = {
  user: { id: 'user', header: 'USER', width: 'w-1/3 content-max-md:flex-[3] content-max-md:min-w-0' },
  roles: { id: 'roles', header: 'ROLE', width: 'w-1/3 content-max-md:flex-[2] content-max-md:min-w-0' },
  status: { id: 'status', header: 'STATUS', width: 'w-1/3', hideAt: 'md' },
  // Same width as `open`, so the two tables' columns line up.
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

export const USERS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  EMPLOYEES_COLUMNS.user,
  EMPLOYEES_COLUMNS.roles,
  EMPLOYEES_COLUMNS.status,
  EMPLOYEES_COLUMNS.open,
];

export const USERS_PAGE_SIZE = 50;

/** The invitations block shows this many, then grows by a page on "Show more". */
export const INVITATIONS_PAGE_SIZE = 5;
