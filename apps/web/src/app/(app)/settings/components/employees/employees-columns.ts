import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Employees tabs, shared by the users table, the
 * invitations table and their skeletons — see `table-column-layout.ts` for why
 * this module is data-only.
 */
export const EMPLOYEES_COLUMNS = {
  user: { id: 'user', header: 'USER', width: 'w-1/3 content-max-md:flex-[3] content-max-md:min-w-0' },
  roles: {
    id: 'roles',
    header: 'ROLE',
    width: 'w-1/3 content-max-md:flex-[2] content-max-md:min-w-0',
    filterable: true,
  },
  status: { id: 'status', header: 'STATUS', width: 'w-1/3', hideAt: 'md', filterable: true },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

export const USERS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  EMPLOYEES_COLUMNS.user,
  EMPLOYEES_COLUMNS.roles,
  EMPLOYEES_COLUMNS.status,
  EMPLOYEES_COLUMNS.open,
];

export const INVITATIONS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  EMPLOYEES_COLUMNS.user,
  EMPLOYEES_COLUMNS.roles,
  EMPLOYEES_COLUMNS.status,
  EMPLOYEES_COLUMNS.actions,
];

export const USERS_PAGE_SIZE = 50;

export const INVITATIONS_PAGE_SIZE = 20;
