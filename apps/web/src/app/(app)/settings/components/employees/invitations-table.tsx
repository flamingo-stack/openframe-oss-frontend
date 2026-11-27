'use client';

import {
  type AutoRefreshControlProps,
  type ColumnDef,
  type DataTableSettings,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { CursorPagerFooterProps } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  invitationsTable_invitation$data,
  invitationsTable_invitation$key,
} from '@/__generated__/invitationsTable_invitation.graphql';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { liveColumnMeta } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { useRowDialog } from '@/app/components/shared/use-row-dialog';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import type { EmployeeFilterOptions, EmployeeSelections } from './employee-filters';
import { EMPLOYEES_COLUMNS, INVITATIONS_PAGE_SIZE } from './employees-columns';
import { type InvitationAction, InvitationActionsCell } from './invitation-actions-cell';
import { InvitationDialog } from './invitation-dialog';
import { InvitationEmailCell, InvitationEmailGridCell } from './invitation-email-cell';
import { InvitationRolesCell } from './invitation-roles-cell';
import { InvitationStatusCell, InvitationStatusGridCell } from './invitation-status-cell';

/**
 * The invitations table — one row per `Invitation`, and the dialog its actions
 * open. Plural: the listing hands over the nodes it has fetched and owns the
 * query and the paging; this module owns what a row looks like and does.
 */
const invitationsTableFragment = graphql`
  fragment invitationsTable_invitation on Invitation @relay(plural: true) {
    id
    ...invitationEmailCell_invitation
    ...invitationRolesCell_invitation
    ...invitationStatusCell_invitation
    ...invitationActionsCell_invitation
    ...invitationDialog_invitation
  }
`;

type InvitationRow = invitationsTable_invitation$data[number];

const getRowId = (row: InvitationRow) => row.id;

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order,
 * resized widths) kept in the browser under this table's own key.
 */
const INVITATIONS_TABLE_SETTINGS: DataTableSettings = { storageKey: 'employees-invitations' };

/**
 * The columns. Each data column states what the grid layout reads beside the card layout's `meta.width`: a `size`
 * (the users table's, so the two views of the page line up), a `minSize` where the cell holds more than text, a
 * one-line `gridCell` and a `label` for the settings menu. `cell` is the card row's cell.
 */
function buildColumns(
  filterOptions: EmployeeFilterOptions,
  onAction: (row: InvitationRow, action: InvitationAction) => void,
): ColumnDef<InvitationRow>[] {
  return [
    {
      id: EMPLOYEES_COLUMNS.user.id,
      header: EMPLOYEES_COLUMNS.user.header,
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationEmailCell invitation={row.original} />,
      size: 360,
      minSize: GRID_MIN_WIDTH.media,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.user, {
        label: 'User',
        gridCell: ({ row }: { row: Row<InvitationRow> }) => <InvitationEmailGridCell invitation={row.original} />,
      }),
    },
    {
      id: EMPLOYEES_COLUMNS.roles.id,
      header: EMPLOYEES_COLUMNS.roles.header,
      // One line of the cell's type already: the grid draws the same cell.
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationRolesCell invitation={row.original} />,
      size: 240,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.roles, { label: 'Role', filter: { options: filterOptions.roles } }),
    },
    {
      id: EMPLOYEES_COLUMNS.status.id,
      header: EMPLOYEES_COLUMNS.status.header,
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationStatusCell invitation={row.original} />,
      size: 200,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.status, {
        label: 'Status',
        filter: { options: filterOptions.status },
        gridCell: ({ row }: { row: Row<InvitationRow> }) => <InvitationStatusGridCell invitation={row.original} />,
      }),
    },
    {
      id: EMPLOYEES_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<InvitationRow> }) => (
        <InvitationActionsCell invitation={row.original} onAction={action => onAction(row.original, action)} />
      ),
      // The grid's action column, kept by hand: `actionColumn()` would replace the card layout's `meta` (its `hideAt`).
      // As `actionColumn()` states them: an action column is never sorted and never hidden.
      enableSorting: false,
      enableHiding: false,
      size: GRID_ACTION_COLUMN_SIZE,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.actions, { gridKind: 'action' }),
    },
  ];
}

// The description is always given: without one the table adds its own
// "Try adjusting your search or filters" under the title.
function emptyState(search: string, isFiltered: boolean) {
  if (search) return { title: `No invitations found matching "${search}"`, description: 'Try adjusting your search.' };
  if (isFiltered) {
    return { title: 'No invitations match the selected filters', description: 'Try adjusting your filters.' };
  }
  return { title: 'No open invitations', description: 'Invite people with Add Users.' };
}

interface InvitationsTableProps {
  /** The rows of the page on screen. */
  rows: invitationsTable_invitation$key;
  /** The server's total for the current search and funnels, not the rows fetched so far. */
  totalCount: number;
  search: string;
  /** A funnel is ticked: an empty table says so instead of "no invitations". */
  isFiltered: boolean;
  filterOptions: EmployeeFilterOptions;
  selections: EmployeeSelections;
  onSelectionsChange: (next: EmployeeSelections) => void;
  /** A refetch is in flight: dims the stale rows. */
  isPending: boolean;
  stickyHeaderOffset: string;
  /** Card rows, or the grid table where the app's table flag is on. */
  layout: TableLayout;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
export function InvitationsTable({
  rows: rowRefs,
  totalCount,
  search,
  isFiltered,
  filterOptions,
  selections,
  onSelectionsChange,
  isPending,
  stickyHeaderOffset,
  layout,
  pager,
  refresh,
}: InvitationsTableProps) {
  const loading = useLoadingScope();
  const rows = useFragment(invitationsTableFragment, rowRefs);
  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<InvitationRow, InvitationAction>();
  // The funnels filter on the server: the table only keeps their state.
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);
  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<InvitationRow>(INVITATIONS_PAGE_SIZE) : null),
    [loading],
  );

  const table = useDataTable<InvitationRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: placeholderRows ?? (rows as InvitationRow[]),
    columns: buildColumns(filterOptions, openDialog),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  return (
    <>
      <LiveTable
        table={table}
        pageSize={INVITATIONS_PAGE_SIZE}
        loadingCells={loading}
        stickyHeaderOffset={stickyHeaderOffset}
        // The grid table is the page's scroll area, as the users table beside it. Card rows read neither the height
        // nor the settings.
        layout={layout}
        maxHeight="fill"
        settings={INVITATIONS_TABLE_SETTINGS}
        itemName="result"
        totalCount={totalCount}
        isPending={isPending}
        emptyState={emptyState(search, isFiltered)}
        pager={pager}
        refresh={refresh}
      />
      {/* Outside the table: revoking the last row still animates the dialog out. */}
      {dialog && (
        <InvitationDialog invitation={dialog.row} kind={dialog.kind} isOpen={dialog.isOpen} onClose={closeDialog} />
      )}
    </>
  );
}
