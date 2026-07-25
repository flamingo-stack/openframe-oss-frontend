'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ListPageSkeleton, type TableSkeletonColumn } from '@/app/components/shared';

/**
 * Route-level skeleton for `/customers` — the tab bar (Active / Archived), the
 * `PageLayout` header `CustomersTable` renders, its search toolbar and the
 * table's column layout (mirrors `buildCustomersColumns`).
 */

const TAB_WIDTHS = ['w-[190px]', 'w-[210px]'] as const;

const ACTIONS: PageActionButton[] = [
  {
    label: 'Add Customer',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon size={24} className="text-ods-text-secondary" />,
  },
];

const COLUMNS: readonly TableSkeletonColumn[] = [
  { id: 'name', header: 'Name', width: 'flex-1 min-w-0' },
  { id: 'deviceCount', header: 'Devices', width: 'w-[200px] shrink-0', hideAt: 'md' },
  { id: 'lastActivityDate', header: 'Last Activity', width: 'w-[200px] shrink-0', hideAt: 'md' },
  { id: 'open', width: 'w-12 shrink-0 flex-none ml-auto', hideAt: 'md', align: 'right' },
];

export function CustomersPageSkeleton() {
  return <ListPageSkeleton title="Customers" actions={ACTIONS} tabWidths={TAB_WIDTHS} columns={COLUMNS} />;
}
