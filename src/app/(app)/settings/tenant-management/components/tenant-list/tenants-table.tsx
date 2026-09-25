'use client';

import { ArrowRightUpIcon, CodingForkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useLayoutEffect } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { tenantsTable_query$data, tenantsTable_query$key } from '@/__generated__/tenantsTable_query.graphql';
import type { tenantsTablePaginationQuery } from '@/__generated__/tenantsTablePaginationQuery.graphql';
import type { tenantsTableQuery as TenantsTableQueryType } from '@/__generated__/tenantsTableQuery.graphql';
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { TenantAccessCell } from './tenant-access-cell';
import { TenantCell } from './tenant-cell';
import { TenantCustomerCell } from './tenant-customer-cell';
import { TENANT_COLUMNS, TENANTS_PAGE_SIZE } from './tenants-table-columns';

const tenantsTableQuery = graphql`
  query tenantsTableQuery($search: String, $first: Int!, $after: String) {
    ...tenantsTable_query @arguments(search: $search, first: $first, after: $after)
  }
`;

const tenantsTableFragment = graphql`
  fragment tenantsTable_query on Query
  @refetchable(queryName: "tenantsTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryConnections(search: $search, first: $first, after: $after)
      @connection(key: "tenantsTable_directoryConnections") {
      totalCount
      edges {
        node {
          id
          name
          ...tenantCell_connection
          ...tenantCustomerCell_connection
          ...tenantAccessCell_connection
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type TenantRow = tenantsTable_query$data['directoryConnections']['edges'][number]['node'];

const tenantRowHref = (row: TenantRow) => routes.settings.tenantDetails(row.id);
const getRowId = (row: TenantRow) => row.id;

const COLUMNS: ColumnDef<TenantRow>[] = [
  {
    id: TENANT_COLUMNS.tenant.id,
    header: TENANT_COLUMNS.tenant.header,
    cell: ({ row }: { row: Row<TenantRow> }) => <TenantCell connection={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(TENANT_COLUMNS.tenant),
  },
  {
    id: TENANT_COLUMNS.customer.id,
    header: TENANT_COLUMNS.customer.header,
    cell: ({ row }: { row: Row<TenantRow> }) => <TenantCustomerCell connection={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(TENANT_COLUMNS.customer),
  },
  {
    id: TENANT_COLUMNS.access.id,
    header: TENANT_COLUMNS.access.header,
    cell: ({ row }: { row: Row<TenantRow> }) => <TenantAccessCell connection={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(TENANT_COLUMNS.access),
  },
  {
    id: TENANT_COLUMNS.open.id,
    cell: ({ row }: { row: Row<TenantRow> }) => (
      // The row itself is the details link; a nested `<a>` is invalid, so this opens the same href.
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
];

interface TenantsTableProps {
  search: string;
  /** The deferred search lags the typed one: the rows on screen are the previous result. */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** Owners get the Connect action in the empty state. */
  canConnect: boolean;
}

/** The tenant rows — suspends on the query, so it lives under the view's `<Suspense>`. */
export function TenantsTable({ search, isPending, onEmptyChange, stickyHeaderOffset, canConnect }: TenantsTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<TenantsTableQueryType>(
    tenantsTableQuery,
    { search: search || null, first: TENANTS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    tenantsTablePaginationQuery,
    tenantsTable_query$key
  >(tenantsTableFragment, queryData);

  const rows = data.directoryConnections.edges.map(edge => edge.node);
  const table = useDataTable<TenantRow>({ data: rows, columns: COLUMNS, getRowId, enableSorting: false });

  const showEmptyState = !search && !isPending && rows.length === 0;
  // Before paint: the view hides its search toolbar over the empty state, so it must not flash first.
  useLayoutEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<CodingForkIcon />}
        title="No tenants connected yet"
        description="Connect a Microsoft 365 or Google Workspace tenant to see its users and access state here."
        buttonLabel={canConnect ? 'Connect Tenant' : undefined}
        buttonProps={{ href: routes.settings.tenantNew() }}
      />
    );
  }

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(TENANTS_PAGE_SIZE);
  };

  return (
    // Dim, don't unmount, the stale rows while a deferred search refetches.
    <div className={cn('transition-opacity duration-200', isPending && 'opacity-60')}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={data.directoryConnections.totalCount} />}
        />
        <DataTable.Body
          skeletonRows={TENANTS_PAGE_SIZE}
          emptyState={{
            title: 'No tenants match',
            description: `Nothing matches "${search}". Try a different name, domain or customer.`,
          }}
          rowClassName="mb-[var(--spacing-system-xxs)]"
          rowHref={tenantRowHref}
        />
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={fetchNextPage}
            skeletonRows={2}
          />
        )}
      </DataTable>
    </div>
  );
}
