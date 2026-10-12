'use client';

import {
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  invitationsTable_invitation$data,
  invitationsTable_invitation$key,
} from '@/__generated__/invitationsTable_invitation.graphql';
import { liveColumnMeta } from '@/app/components/shared';
import { useRowDialog } from '@/app/components/shared/use-row-dialog';
import { EMPLOYEES_COLUMNS } from './employees-columns';
import { type InvitationAction, InvitationActionsCell } from './invitation-actions-cell';
import { InvitationDialog } from './invitation-dialog';
import { InvitationEmailCell } from './invitation-email-cell';
import { InvitationRolesCell } from './invitation-roles-cell';
import { InvitationStatusCell } from './invitation-status-cell';

/**
 * The invitations block — one row per `Invitation`, and the dialog its actions
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
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.roles),
    },
    {
      id: EMPLOYEES_COLUMNS.status.id,
      header: EMPLOYEES_COLUMNS.status.header,
      cell: ({ row }: { row: Row<InvitationRow> }) => <InvitationStatusCell invitation={row.original} />,
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.status),
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

interface InvitationsTableProps {
  /** The pages fetched so far. */
  rows: invitationsTable_invitation$key;
  /** The server's total for the current search, not the rows fetched so far. */
  totalCount: number;
  /** The listings the dialogs' mutations update, the one the rows came from first. */
  listingIds: readonly string[];
  /** A refetch is in flight: dims the stale rows. */
  isPending: boolean;
  /** Under the rows, e.g. "Show more". */
  children?: ReactNode;
}

/** Hidden when nothing matches; the dialog stays, so revoking the last row still animates out. */
export function InvitationsTable({
  rows: rowRefs,
  totalCount,
  listingIds,
  isPending,
  children,
}: InvitationsTableProps) {
  const rows = useFragment(invitationsTableFragment, rowRefs);
  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<InvitationRow, InvitationAction>();

  const table = useDataTable<InvitationRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as InvitationRow[],
    columns: buildColumns(openDialog),
    getRowId,
    enableSorting: false,
  });

  return (
    <>
      {totalCount > 0 && (
        <section
          aria-label="Invitations"
          className={`mb-[var(--spacing-system-l)] flex flex-col gap-[var(--spacing-system-s)] transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}
        >
          <DataTable table={table}>
            <DataTable.Header rightSlot={<DataTable.RowCount itemName="invitation" totalCount={totalCount} />} />
            <DataTable.Body />
          </DataTable>
          {children}
        </section>
      )}
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
