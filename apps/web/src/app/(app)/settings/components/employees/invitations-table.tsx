'use client';

import {
  Button,
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type {
  invitationsTable_query$data,
  invitationsTable_query$key,
} from '@/__generated__/invitationsTable_query.graphql';
import type { invitationsTablePaginationQuery } from '@/__generated__/invitationsTablePaginationQuery.graphql';
import type { invitationsTableQuery } from '@/__generated__/invitationsTableQuery.graphql';
import type { invitationsTableResendMutation } from '@/__generated__/invitationsTableResendMutation.graphql';
import type { invitationsTableRevokeMutation } from '@/__generated__/invitationsTableRevokeMutation.graphql';
import { liveColumnMeta } from '@/app/components/shared';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { ConfirmRemoveInvitationModal } from '../confirm-remove-invitation-modal';
import { ConfirmResendInvitationModal } from '../confirm-resend-invitation-modal';
import { ConfirmRevokeInvitationModal } from '../confirm-revoke-invitation-modal';
import { EMPLOYEES_COLUMNS, INVITATIONS_PAGE_SIZE } from './employees-columns';
import { type InvitationAction, InvitationActionsCell, type InvitationTarget } from './invitation-actions-cell';
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
      __id
      filteredCount
      edges {
        node {
          id
          ...invitationEmailCell_invitation
          ...invitationRolesCell_invitation
          ...invitationStatusCell_invitation
          ...invitationActionsCell_invitation
        }
      }
    }
  }
`;

const revokeInvitationMutation = graphql`
  mutation invitationsTableRevokeMutation($id: ID!, $connections: [ID!]!) {
    revokeInvitation(input: { id: $id }) {
      revokedInvitationId @deleteEdge(connections: $connections)
    }
  }
`;

const resendInvitationMutation = graphql`
  mutation invitationsTableResendMutation($id: ID!, $connections: [ID!]!) {
    resendInvitation(input: { id: $id }) {
      revokedInvitationId @deleteEdge(connections: $connections)
      invitationEdge @prependEdge(connections: $connections) {
        cursor
        node {
          id
          ...invitationEmailCell_invitation
          ...invitationRolesCell_invitation
          ...invitationStatusCell_invitation
          ...invitationActionsCell_invitation
        }
      }
    }
  }
`;

type InvitationRow = invitationsTable_query$data['invitations']['edges'][number]['node'];

/** A revoke takes one invitation out of the block's count; a resend swaps one for another. */
function decrementFilteredCount(store: RecordSourceSelectorProxy, connectionId: string) {
  const connection = store.get(connectionId);
  const count = connection?.getValue('filteredCount');
  if (connection && typeof count === 'number') {
    connection.setValue(Math.max(count - 1, 0), 'filteredCount');
  }
}

/** "Show more" grows the block by this many. */
const SHOW_MORE_SIZE = 20;

const getRowId = (row: InvitationRow) => row.id;

interface InvitationsTableProps {
  search: string;
  isPending: boolean;
  /** Bumped by the page after it sends invites. A revoke or resend updates the block in the store. */
  fetchKey: number;
}

/**
 * Open invitations above the users: a few newest first, more on request, so a
 * pile of unanswered invites never pushes the people off the page. Hidden when
 * nothing matches.
 */
export function InvitationsTable({ search, isPending, fetchKey }: InvitationsTableProps) {
  const queryData = useLazyLoadQuery<invitationsTableQuery>(
    invitationsTableQueryNode,
    { search: search || null, first: INVITATIONS_PAGE_SIZE },
    { fetchPolicy: 'store-and-network', fetchKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    invitationsTablePaginationQuery,
    invitationsTable_query$key
  >(invitationsTableFragment, queryData);

  const { toast } = useToast();
  const [commitRevoke, isRevoking] = useMutation<invitationsTableRevokeMutation>(revokeInvitationMutation);
  const [commitResend, isResending] = useMutation<invitationsTableResendMutation>(resendInvitationMutation);
  const [pending, setPending] = useState<{ action: InvitationAction; target: InvitationTarget } | null>(null);

  const closeDialog = (open: boolean) => {
    if (!open) setPending(null);
  };
  const confirm = () => {
    if (!pending) return;
    const connectionId = data.invitations.__id;
    const variables = { id: pending.target.id, connections: [connectionId] };
    const onCompleted = () => setPending(null);
    if (pending.action === 'resend') {
      commitResend({
        variables,
        onCompleted,
        onError: error => {
          toast({
            title: 'Error',
            description: getRelayErrorMessage(error, 'Failed to resend invitation'),
            variant: 'destructive',
          });
        },
      });
      return;
    }
    commitRevoke({
      variables,
      updater: store => decrementFilteredCount(store, connectionId),
      onCompleted,
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to revoke invitation'),
          variant: 'destructive',
        });
      },
    });
  };

  const columns: ColumnDef<InvitationRow>[] = [
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
        <InvitationActionsCell
          invitation={row.original}
          onAction={(action, target) => setPending({ action, target })}
        />
      ),
      meta: liveColumnMeta(EMPLOYEES_COLUMNS.actions),
    },
  ];

  const rows = data.invitations.edges.map(edge => edge.node);
  const table = useDataTable<InvitationRow>({
    data: rows as InvitationRow[],
    columns,
    getRowId,
    enableSorting: false,
  });

  if (data.invitations.filteredCount === 0) {
    return null;
  }

  const busy = isPending || isRevoking || isResending;
  const email = pending?.target.email ?? '';

  return (
    <section
      aria-label="Invitations"
      className={`mb-[var(--spacing-system-l)] flex flex-col gap-[var(--spacing-system-s)] transition-opacity duration-200 ${busy ? 'opacity-60' : ''}`}
    >
      <DataTable table={table}>
        <DataTable.Header
          rightSlot={<DataTable.RowCount itemName="invitation" totalCount={data.invitations.filteredCount} />}
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
      <ConfirmRevokeInvitationModal
        open={pending?.action === 'revoke'}
        onOpenChange={closeDialog}
        userEmail={email}
        onConfirm={confirm}
      />
      <ConfirmRemoveInvitationModal
        open={pending?.action === 'remove'}
        onOpenChange={closeDialog}
        userEmail={email}
        onConfirm={confirm}
      />
      <ConfirmResendInvitationModal
        open={pending?.action === 'resend'}
        onOpenChange={closeDialog}
        userEmail={email}
        onConfirm={confirm}
      />
    </section>
  );
}
