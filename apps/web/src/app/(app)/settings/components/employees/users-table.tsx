'use client';

import {
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { usersTable_user$data, usersTable_user$key } from '@/__generated__/usersTable_user.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { liveColumnMeta } from '@/app/components/shared';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { rawIdOf } from '@/lib/relay-id';
import { type EmployeeSelections, ROLE_FILTER_OPTIONS, USER_STATUS_FILTER_OPTIONS } from './employee-filters';
import { EmployeeRolesCell } from './employee-roles-cell';
import { EmployeeStatusCell } from './employee-status-cell';
import { EmployeeUserCell } from './employee-user-cell';
import { EMPLOYEES_COLUMNS } from './employees-columns';

/**
 * The users table — one row per `User`. Plural: the listing hands over a page of
 * nodes at a time and owns the query and the paging; this module owns what a row
 * looks like.
 */
const usersTableFragment = graphql`
  fragment usersTable_user on User @relay(plural: true) {
    id
    ...employeeUserCell_user
    ...employeeRolesCell_user
    ...employeeStatusCell_user
  }
`;

type UserRow = usersTable_user$data[number];

// The employee page takes the raw id; the node id is the Relay global one.
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
    meta: liveColumnMeta(EMPLOYEES_COLUMNS.roles, { filter: { options: ROLE_FILTER_OPTIONS } }),
  },
  {
    id: EMPLOYEES_COLUMNS.status.id,
    header: EMPLOYEES_COLUMNS.status.header,
    cell: ({ row }: { row: Row<UserRow> }) => <EmployeeStatusCell user={row.original} />,
    meta: liveColumnMeta(EMPLOYEES_COLUMNS.status, { filter: { options: USER_STATUS_FILTER_OPTIONS } }),
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

function emptyTitle(search: string, isFiltered: boolean): string {
  if (search) return `No users found matching "${search}". Try adjusting your search.`;
  if (isFiltered) return 'No users match the selected filters. Try adjusting your filters.';
  return 'No users found.';
}

interface UsersTableProps {
  /** The pages fetched so far. */
  rows: usersTable_user$key;
  /** The server's total for the current search and funnels, not the rows fetched so far. */
  totalCount: number;
  search: string;
  /** A funnel is ticked: an empty table says so instead of "no users". */
  isFiltered: boolean;
  selections: EmployeeSelections;
  onSelectionsChange: (next: EmployeeSelections) => void;
  /** A refetch is in flight: dims the stale rows. */
  isPending: boolean;
  stickyHeaderOffset: string;
  infiniteScroll: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
  };
}

export function UsersTable({
  rows: rowRefs,
  totalCount,
  search,
  isFiltered,
  selections,
  onSelectionsChange,
  isPending,
  stickyHeaderOffset,
  infiniteScroll,
}: UsersTableProps) {
  const rows = useFragment(usersTableFragment, rowRefs);
  // The funnels filter on the server: the table only keeps their state.
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);

  const table = useDataTable<UserRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as UserRow[],
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  return (
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
        />
        <DataTable.Body emptyState={{ title: emptyTitle(search, isFiltered) }} rowHref={detailHref} />
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={infiniteScroll.hasNextPage}
            isFetchingNextPage={infiniteScroll.isFetchingNextPage}
            onLoadMore={infiniteScroll.onLoadMore}
          />
        )}
      </DataTable>
    </div>
  );
}
