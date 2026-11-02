'use client';

import {
  type ColumnDef,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { usersTable_user$data, usersTable_user$key } from '@/__generated__/usersTable_user.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { type InfiniteScroll, liveColumnMeta } from '@/app/components/shared';
import { oneLineEmptyState } from '@/app/components/shared/empty-state';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { rawIdOf } from '@/lib/relay-id';
import type { EmployeeFilterOptions, EmployeeSelections } from './employee-filters';
import { EmployeeRolesCell } from './employee-roles-cell';
import { EmployeeStatusCell } from './employee-status-cell';
import { EmployeeUserCell } from './employee-user-cell';
import { EMPLOYEES_COLUMNS, USERS_PAGE_SIZE } from './employees-columns';

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

function buildColumns(filterOptions: EmployeeFilterOptions): ColumnDef<UserRow>[] {
  return [
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
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.roles, { filter: { options: filterOptions.roles } }),
    },
    {
      id: EMPLOYEES_COLUMNS.status.id,
      header: EMPLOYEES_COLUMNS.status.header,
      cell: ({ row }: { row: Row<UserRow> }) => <EmployeeStatusCell user={row.original} />,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.status, { filter: { options: filterOptions.status } }),
    },
    {
      id: EMPLOYEES_COLUMNS.open.id,
      cell: ({ row }: { row: Row<UserRow> }) => (
        <OpenRowButton label="Open in new tab" onClick={openInNewTab(detailHref(row.original))} />
      ),
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.open),
    },
  ];
}

const getRowId = (row: UserRow) => row.id;

// The description is always given: without one the table adds its own
// "Try adjusting your search or filters" under the title.
function emptyState(search: string, isFiltered: boolean) {
  if (search) return { title: `No users found matching "${search}"`, description: 'Try adjusting your search.' };
  if (isFiltered) return { title: 'No users match the selected filters', description: 'Try adjusting your filters.' };
  return oneLineEmptyState('No users found');
}

interface UsersTableProps {
  /** The pages fetched so far. */
  rows: usersTable_user$key;
  /** The server's total for the current search and funnels, not the rows fetched so far. */
  totalCount: number;
  search: string;
  /** A funnel is ticked: an empty table says so instead of "no users". */
  isFiltered: boolean;
  filterOptions: EmployeeFilterOptions;
  selections: EmployeeSelections;
  onSelectionsChange: (next: EmployeeSelections) => void;
  /** A refetch is in flight: dims the stale rows. */
  isPending: boolean;
  stickyHeaderOffset: string;
  infiniteScroll: InfiniteScroll;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
export function UsersTable({
  rows: rowRefs,
  totalCount,
  search,
  isFiltered,
  filterOptions,
  selections,
  onSelectionsChange,
  isPending,
  stickyHeaderOffset,
  infiniteScroll,
}: UsersTableProps) {
  const loading = useLoadingScope();
  const rows = useFragment(usersTableFragment, rowRefs);
  // The funnels filter on the server: the table only keeps their state.
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);
  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(() => (loading ? loadingPlaceholderRows<UserRow>(USERS_PAGE_SIZE) : null), [loading]);

  const table = useDataTable<UserRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: placeholderRows ?? (rows as UserRow[]),
    columns: buildColumns(filterOptions),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  return (
    <LiveTable
      table={table}
      pageSize={USERS_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      isPending={isPending}
      emptyState={emptyState(search, isFiltered)}
      rowHref={detailHref}
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}
