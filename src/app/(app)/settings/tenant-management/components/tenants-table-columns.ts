import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout of the tenants list (Figma 1699-8249: Tenant · Customers ·
 * Access · open). Data-only on purpose (see `table-column-layout.ts`): the live
 * table and the route skeleton read the SAME widths, so nothing shifts when the
 * rows arrive, and the skeleton never imports the table's cell renderers.
 */
const TENANT_COLUMNS = {
  tenant: { id: 'tenant', header: 'Tenant', width: 'flex-1 min-w-0' },
  customer: { id: 'customer', header: 'Customers', width: 'w-[220px] lg:w-[340px]', hideAt: 'md' },
  access: { id: 'access', header: 'Access', width: 'w-[200px] lg:w-[216px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { TENANT_COLUMNS };

/** Render order of the standalone list. */
export const TENANTS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  TENANT_COLUMNS.tenant,
  TENANT_COLUMNS.customer,
  TENANT_COLUMNS.access,
  TENANT_COLUMNS.open,
];
