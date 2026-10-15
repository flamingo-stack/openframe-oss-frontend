'use client';

import {
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type {
  invitationsTable_invitation$data,
  invitationsTable_invitation$key,
} from '@/__generated__/invitationsTable_invitation.graphql';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { liveColumnMeta } from '@/app/components/shared';
import { useRowDialog } from '@/app/components/shared/use-row-dialog';
import { type EmployeeSelections, INVITATION_STATUS_FILTER_OPTIONS, ROLE_FILTER_OPTIONS } from './employee-filters';
import { EMPLOYEES_COLUMNS } from './employees-columns';
import { type InvitationAction, InvitationActionsCell } from './invitation-actions-cell';
import { InvitationDialog } from './invitation-dialog';
import { InvitationEmailCell } from './invitation-email-cell';
import { InvitationRolesCell } from './invitation-roles-cell';
import { InvitationStatusCell } from './invitation-status-cell';

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

function buildColumns(onAction: (row: InvitationRow, action: InvitationAction) => void): ColumnDef<InvitationRow>[] {
  return [
    {
      id: EMPLOYEES_COLUMNS.user.id,
      header: EMPLOYEES_COLUMNS.user.header,
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationEmailCell invitation={row.original} />,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.user),
    },
    {
      id: EMPLOYEES_COLUMNS.roles.id,
      header: EMPLOYEES_COLUMNS.roles.header,
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationRolesCell invitation={row.original} />,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.roles, { filter: { options: ROLE_FILTER_OPTIONS } }),
    },
    {
      id: EMPLOYEES_COLUMNS.status.id,
      header: EMPLOYEES_COLUMNS.status.header,
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationStatusCell invitation={row.original} />,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.status, { filter: { options: INVITATION_STATUS_FILTER_OPTIONS } }),
    },
    {
      id: EMPLOYEES_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<InvitationRow> }) => (
        <InvitationActionsCell invitation={row.original} onAction={action => onAction(row.original, action)} />
      ),
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.actions),
    },
  ];
}

function emptyTitle(search: string, isFiltered: boolean): string {
  if (search) return `No invitations found matching "${search}". Try adjusting your search.`;
  if (isFiltered) return 'No invitations match the selected filters. Try adjusting your filters.';
  return 'No open invitations. Invite people with Add Users.';
}

interface InvitationsTableProps {
  /** The pages fetched so far. */
  rows: invitationsTable_invitation$key;
  /** The server's total for the current search and funnels, not the rows fetched so far. */
  totalCount: number;
  search: string;
  /** A funnel is ticked: an empty table says so instead of "no invitations". */
  isFiltered: boolean;
  selections: EmployeeSelections;
  onSelectionsChange: (next: EmployeeSelections) => void;
  /** The records the dialogs' mutations update, the listing the rows came from first. */
  listingIds: readonly string[];
  /** A refetch is in flight: dims the stale rows. */
  isPending: boolean;
  stickyHeaderOffset: string;
  infiniteScroll: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
  };
}

export function InvitationsTable({
  rows: rowRefs,
  totalCount,
  search,
  isFiltered,
  selections,
  onSelectionsChange,
  listingIds,
  isPending,
  stickyHeaderOffset,
  infiniteScroll,
}: InvitationsTableProps) {
  const rows = useFragment(invitationsTableFragment, rowRefs);
  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<InvitationRow, InvitationAction>();
  // The funnels filter on the server: the table only keeps their state.
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);

  const table = useDataTable<InvitationRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as InvitationRow[],
    columns: buildColumns(openDialog),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  return (
    <>
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
          />
          <DataTable.Body emptyState={{ title: emptyTitle(search, isFiltered) }} />
          {rows.length > 0 && (
            <DataTable.InfiniteFooter
              hasNextPage={infiniteScroll.hasNextPage}
              isFetchingNextPage={infiniteScroll.isFetchingNextPage}
              onLoadMore={infiniteScroll.onLoadMore}
            />
          )}
        </DataTable>
      </div>
      {/* Outside the table: revoking the last row still animates the dialog out. */}
      {dialog && (
        <InvitationDialog
          invitation={dialog.row}
          kind={dialog.kind}
          isOpen={dialog.isOpen}
          onClose={closeDialog}
          listingIds={listingIds}
        />
      )}
    </>
  );
}
