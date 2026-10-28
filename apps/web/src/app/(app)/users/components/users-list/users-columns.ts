import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/** On a phone the Status cell is its tag alone (Figma 907:31981), sized to it so the name keeps the row. */
const STATUS_PHONE_WIDTH = 'flex-none';

/**
 * Column layout for the Users list (Figma 733:99047), read by the live table — see `table-column-layout.ts` for why
 * this module is data-only. The Customer column's funnel narrows by tenant (contract F1), so its id is `tenant`.
 */
const USER_COLUMNS = {
  user: { id: 'user', header: 'User', width: 'flex-[2] min-w-0' },
  tenant: { id: 'tenant', header: 'Customer', width: 'flex-[2] min-w-0', hideAt: 'md' },
  devices: { id: 'devices', header: 'Devices', width: 'flex-1 min-w-0', hideAt: 'lg' },
  status: {
    id: 'status',
    header: 'Status',
    width: `${STATUS_PHONE_WIDTH} content-md:flex-1 content-md:min-w-[7.5rem]`,
  },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * A customer's Users tab (Figma 733:98943): fixed Devices / Status / Licences columns, the user takes the rest. A
 * tablet keeps Devices and drops Licences (889:52494); a phone keeps the user and the status.
 */
const CUSTOMER_USER_COLUMNS = {
  user: { id: USER_COLUMNS.user.id, header: USER_COLUMNS.user.header, width: 'flex-1 min-w-0' },
  devices: { id: USER_COLUMNS.devices.id, header: USER_COLUMNS.devices.header, width: 'w-40 shrink-0', hideAt: 'md' },
  status: {
    id: USER_COLUMNS.status.id,
    header: USER_COLUMNS.status.header,
    width: `${STATUS_PHONE_WIDTH} content-md:w-36`,
  },
  license: { id: 'license', header: 'Licences', width: 'w-[12.5rem] shrink-0', hideAt: 'lg' },
  open: USER_COLUMNS.open,
} satisfies Record<string, TableSkeletonColumn>;

export { CUSTOMER_USER_COLUMNS, USER_COLUMNS };

export const USERS_PAGE_SIZE = 20;
