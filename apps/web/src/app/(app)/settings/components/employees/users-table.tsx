'use client';

import {
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { usersTable_query$data, usersTable_query$key } from '@/__generated__/usersTable_query.graphql';
import type { usersTablePaginationQuery } from '@/__generated__/usersTablePaginationQuery.graphql';
import type { usersTableQuery } from '@/__generated__/usersTableQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { OpenRowButton } from '@/app/(app)/software/components/shared/open-row-button';
import { liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { rawIdOf } from '@/lib/relay-id';
import { EmployeeRolesCell } from './employee-roles-cell';
import { EmployeeStatusCell } from './employee-status-cell';
import { EmployeeUserCell } from './employee-user-cell';
import { EMPLOYEES_COLUMNS, USERS_PAGE_SIZE } from './employees-columns';

const usersTableQueryNode = graphql`
  query usersTableQuery($search: String, $first: Int!) {
    ...usersTable_query @arguments(search: $search, first: $first)
  }
`;

const usersTableFragment = graphql`
  fragment usersTable_query on Query
  @refetchable(queryName: "usersTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  ) {
    users(search: $search, first: $first, after: $after) @connection(key: "usersTable_users") {
      filteredCount
      edges {
        node {
          id
          ...employeeUserCell_user
          ...employeeRolesCell_user
          ...employeeStatusCell_user
        }
      }
    }
  }
`;

type UserRow = usersTable_query$data['users']['edges'][number]['node'];

// The employee page and REST take the raw id; the node id is the Relay global one.
const detailHref = (row: UserRow) => employeeDetailHref(rawIdOf(row.id));

const COLUMNS: ColumnDef<UserRow>[] = [
  {
    id: EMPLOYEES_COLUMNS.user.id,
    header: EMPLOYEES_COLUMNS.user.header,
    cell: ({ row }: { row: Row<UserRow> }) => <EmployeeUserCell user={row.original} />,
    meta: liveColumnMeta(EMPLOYEES_COLUMNS.user),
  },
  {
    id: EMPLOYEES_COLUMNS.roles.id,
    header: EMPLOYEES_COLUMNS.roles.header,
    cell: ({ row }: { row: Row<UserRow> }) => <EmployeeRolesCell user={row.original} />,
    meta: liveColumnMeta(EMPLOYEES_COLUMNS.roles),
  },
  {
    id: EMPLOYEES_COLUMNS.status.id,
    header: EMPLOYEES_COLUMNS.status.header,
    cell: ({ row }: { row: Row<UserRow> }) => <EmployeeStatusCell user={row.original} />,
    meta: liveColumnMeta(EMPLOYEES_COLUMNS.status),
  },
  {
    id: EMPLOYEES_COLUMNS.open.id,
    cell: ({ row }: { row: Row<UserRow> }) => (
      <OpenRowButton label="Open in new tab" onClick={openInNewTab(detailHref(row.original))} />
    ),
    meta: liveColumnMeta(EMPLOYEES_COLUMNS.open),
  },
];

const getRowId = (row: UserRow) => row.id;

interface UsersTableProps {
  search: string;
  /** The deferred search lags the box: the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
}

/** The tenant's users, searched and paged on the server. Suspends on the first page. */
export function UsersTable({ search, isPending, stickyHeaderOffset }: UsersTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<usersTableQuery>(
    usersTableQueryNode,
    { search: search || null, first: USERS_PAGE_SIZE },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    usersTablePaginationQuery,
    usersTable_query$key
  >(usersTableFragment, queryData);

  const rows = data.users.edges.map(edge => edge.node);

  const table = useDataTable<UserRow>({
    data: rows as UserRow[],
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });

  return (
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="user" totalCount={data.users.filteredCount} />}
        />
        <DataTable.Body
          emptyState={{
            title: search ? `No users found matching "${search}". Try adjusting your search.` : 'No users found.',
          }}
          rowHref={detailHref}
        />
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={() => {
              if (hasNext && !isLoadingNext) loadNext(USERS_PAGE_SIZE);
            }}
          />
        )}
      </DataTable>
    </div>
  );
}
