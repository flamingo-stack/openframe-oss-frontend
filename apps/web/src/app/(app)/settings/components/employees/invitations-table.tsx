'use client';

import {
  Button,
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useRelayEnvironment,
  useSubscribeToInvalidationState,
} from 'react-relay';
import type {
  invitationsTable_query$data,
  invitationsTable_query$key,
} from '@/__generated__/invitationsTable_query.graphql';
import type { invitationsTablePaginationQuery } from '@/__generated__/invitationsTablePaginationQuery.graphql';
import type { invitationsTableQuery } from '@/__generated__/invitationsTableQuery.graphql';
import { liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { useRowDialog } from '@/app/components/shared/use-row-dialog';
import { EMPLOYEES_COLUMNS, INVITATIONS_PAGE_SIZE } from './employees-columns';
import { type InvitationAction, InvitationActionsCell } from './invitation-actions-cell';
import { InvitationDialog } from './invitation-dialog';
import { InvitationEmailCell } from './invitation-email-cell';
import { InvitationRolesCell } from './invitation-roles-cell';
import { InvitationStatusCell } from './invitation-status-cell';

const invitationsTableQueryNode = graphql`
  query invitationsTableQuery($search: String, $first: Int!) {
    ...invitationsTable_query @arguments(search: $search, first: $first)
  }
`;

const invitationsTableFragment = graphql`
  fragment invitationsTable_query on Query
  @refetchable(queryName: "invitationsTablePaginationQuery")
  @argumentDefinitions(search: { type: "String" }, first: { type: "Int", defaultValue: 5 }, after: { type: "String" }) {
    invitations(search: $search, first: $first, after: $after) @connection(key: "invitationsTable_invitations") {
      # Invite and resend mark the listing stale (see invitations-listing.ts); it is refetched below.
      __id
      filteredCount
      edges {
        node {
          id
          ...invitationEmailCell_invitation
          ...invitationRolesCell_invitation
          ...invitationStatusCell_invitation
          ...invitationActionsCell_invitation
          ...invitationDialog_invitation
        }
      }
    }
  }
`;

type InvitationRow = invitationsTable_query$data['invitations']['edges'][number]['node'];

/** "Show more" grows the block by this many. */
const SHOW_MORE_SIZE = 20;

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
  search: string;
  /** A deferred search is in flight: the rows on screen are the previous result. */
  isPending: boolean;
}

/**
 * Open invitations above the users: a few newest first, more on request, so a
 * pile of unanswered invites never pushes the people off the page. Hidden when
 * nothing matches.
 */
export function InvitationsTable({ search, isPending }: InvitationsTableProps) {
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const variables = { search: search || null, first: INVITATIONS_PAGE_SIZE };
  const queryData = useLazyLoadQuery<invitationsTableQuery>(invitationsTableQueryNode, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    invitationsTablePaginationQuery,
    invitationsTable_query$key
  >(invitationsTableFragment, queryData);
  const { invitations } = data;

  useSubscribeToInvalidationState([invitations.__id], () => {
    fetchQuery(environment, invitationsTableQueryNode, variables, { fetchPolicy: 'network-only' }).subscribe({});
  });

  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<InvitationRow, InvitationAction>();

  const table = useDataTable<InvitationRow>({
    data: invitations.edges.map(edge => edge.node),
    columns: buildColumns(openDialog),
    getRowId,
    enableSorting: false,
  });

  return (
    <>
      {invitations.filteredCount > 0 && (
        <section
          aria-label="Invitations"
          className={`mb-[var(--spacing-system-l)] flex flex-col gap-[var(--spacing-system-s)] transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}
        >
          <DataTable table={table}>
            <DataTable.Header
              rightSlot={<DataTable.RowCount itemName="invitation" totalCount={invitations.filteredCount} />}
            />
            <DataTable.Body />
          </DataTable>
          {hasNext && (
            <Button
              variant="outline"
              className="self-center"
              loading={isLoadingNext}
              onClick={() => loadNext(SHOW_MORE_SIZE)}
            >
              Show more invitations
            </Button>
          )}
        </section>
      )}
      {/* Outside the block: revoking the last invitation hides it mid-dialog. */}
      {dialog && (
        <InvitationDialog
          invitation={dialog.row}
          kind={dialog.kind}
          isOpen={dialog.isOpen}
          onClose={closeDialog}
          listingId={invitations.__id}
        />
      )}
    </>
  );
}
