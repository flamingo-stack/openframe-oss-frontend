'use client';

import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  SquareAvatar,
  type NoDataProps,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo } from 'react';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import type { TenantConnection } from '../types/tenant-connection';
import {
  accessStateTag,
  formatLastRead,
  lastReadAt,
  providerPresentation,
  usersCountLabel,
} from '../utils/tenant-presentation';
import { TENANT_COLUMNS } from './tenants-table-columns';

/** Provider mark + name over the domain (the "Tenant" cell). */
function TenantCell({ connection }: { connection: TenantConnection }) {
  const { Logo, label } = providerPresentation(connection.provider);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <Logo size={24} role="img" aria-label={label} className="shrink-0" />
        <TruncateText>{connection.name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {connection.domain}
      </TruncateText>
    </div>
  );
}

/** Customer logo + name over the synced user count (the "Customers" cell). */
function CustomerCell({ connection }: { connection: TenantConnection }) {
  const { organization, userCount } = connection;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <SquareAvatar
          src={getFullImageUrl(organization.imageUrl)}
          alt={organization.name}
          fallback={organization.name}
          size="xs"
          variant="square"
        />
        <TruncateText>{organization.name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {usersCountLabel(userCount)}
      </TruncateText>
    </div>
  );
}

/** Access tag over "Last read: …" (the "Access" cell). */
function AccessCell({ connection }: { connection: TenantConnection }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...accessStateTag(connection.access.state)} className="self-start" />
      <TruncateText variant="h6" tone="secondary">
        {`Last read: ${formatLastRead(lastReadAt(connection))}`}
      </TruncateText>
    </div>
  );
}

const tenantRowHref = (connection: TenantConnection) => routes.settings.tenantDetails(connection.id);

function buildColumns(hideCustomerColumn: boolean): ColumnDef<TenantConnection>[] {
  const columns: ColumnDef<TenantConnection>[] = [
    {
      id: TENANT_COLUMNS.tenant.id,
      header: TENANT_COLUMNS.tenant.header,
      cell: ({ row }: { row: Row<TenantConnection> }) => <TenantCell connection={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(TENANT_COLUMNS.tenant),
    },
  ];
  if (!hideCustomerColumn) {
    columns.push({
      id: TENANT_COLUMNS.customer.id,
      header: TENANT_COLUMNS.customer.header,
      cell: ({ row }: { row: Row<TenantConnection> }) => <CustomerCell connection={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(TENANT_COLUMNS.customer),
    });
  }
  columns.push(
    {
      id: TENANT_COLUMNS.access.id,
      header: TENANT_COLUMNS.access.header,
      cell: ({ row }: { row: Row<TenantConnection> }) => <AccessCell connection={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(TENANT_COLUMNS.access),
    },
    {
      id: TENANT_COLUMNS.open.id,
      cell: ({ row }: { row: Row<TenantConnection> }) => (
        // The row itself is the details link; a nested `<a>` is invalid, so the
        // new-tab affordance is a button that opens the same href programmatically.
        <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
          <Button
            onClick={openInNewTab(tenantRowHref(row.original))}
            variant="outline"
            size="icon"
            leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
            aria-label={`Open ${row.original.name} in new tab`}
            className="bg-ods-card"
          />
        </div>
      ),
      enableSorting: false,
      meta: liveColumnMeta(TENANT_COLUMNS.open),
    },
  );
  return columns;
}

/** Referentially stable fallback so an absent list never hands the table a fresh array per render. */
const NO_CONNECTIONS: TenantConnection[] = [];

interface TenantsTableProps {
  connections: readonly TenantConnection[] | undefined;
  isLoading: boolean;
  /** What the body shows with zero rows — the caller decides between "no match" and "couldn't load". */
  emptyState: NoDataProps;
  hideCustomerColumn?: boolean;
  stickyHeaderOffset?: string;
}

export function TenantsTable({
  connections,
  isLoading,
  emptyState,
  hideCustomerColumn = false,
  stickyHeaderOffset,
}: TenantsTableProps) {
  // Manual memos on purpose: TanStack compares `data`/`columns` by identity.
  const data = useMemo(() => (connections ? [...connections] : NO_CONNECTIONS), [connections]);
  const columns = useMemo(() => buildColumns(hideCustomerColumn), [hideCustomerColumn]);
  const getRowId = useCallback((row: TenantConnection) => row.id, []);

  const table = useDataTable<TenantConnection>({ data, columns, getRowId, enableSorting: false });

  return (
    <DataTable table={table}>
      <DataTable.Header
        rightSlot={<DataTable.RowCount itemName="result" />}
        stickyHeader
        stickyHeaderOffset={stickyHeaderOffset}
      />
      <DataTable.Body
        loading={isLoading}
        emptyState={emptyState}
        rowHref={tenantRowHref}
        rowClassName="mb-[var(--spacing-system-xxs)]"
      />
    </DataTable>
  );
}
