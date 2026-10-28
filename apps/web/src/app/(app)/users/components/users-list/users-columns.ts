import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the Users list (Figma 733:99047), read by the live table — see `table-column-layout.ts` for why
 * this module is data-only. The Customer column's funnel narrows by tenant (contract F1), so its id is `tenant`.
 */
const USER_COLUMNS = {
  user: { id: 'user', header: 'User', width: 'flex-[2] min-w-0' },
  tenant: { id: 'tenant', header: 'Customer', width: 'flex-[2] min-w-0', hideAt: 'md' },
  devices: { id: 'devices', header: 'Devices', width: 'flex-1 min-w-0', hideAt: 'lg' },
  status: { id: 'status', header: 'Status', width: 'flex-1 min-w-[7.5rem]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { USER_COLUMNS };

export const USERS_PAGE_SIZE = 20;
