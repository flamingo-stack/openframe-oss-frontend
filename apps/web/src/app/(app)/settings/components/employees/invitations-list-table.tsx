'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useRelayEnvironment,
  useSubscribeToInvalidationState,
} from 'react-relay';
import type { invitationsListTable_query$key } from '@/__generated__/invitationsListTable_query.graphql';
import type { invitationsListTablePaginationQuery } from '@/__generated__/invitationsListTablePaginationQuery.graphql';
import type { invitationsListTableQuery } from '@/__generated__/invitationsListTableQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { INVITATIONS_PAGE_SIZE } from './employees-columns';
import { affectedInvitationsListings } from './invitations-listing';
import { InvitationsTable } from './invitations-table';

const invitationsListTableQueryNode = graphql`
  query invitationsListTableQuery($search: String, $first: Int!) {
    ...invitationsListTable_query @arguments(search: $search, first: $first)
  }
`;

const invitationsListTableFragment = graphql`
  fragment invitationsListTable_query on Query
  @refetchable(queryName: "invitationsListTablePaginationQuery")
  @argumentDefinitions(search: { type: "String" }, first: { type: "Int", defaultValue: 5 }, after: { type: "String" }) {
    invitations(search: $search, first: $first, after: $after) @connection(key: "invitationsListTable_invitations") {
      # The dialogs' mutations reach this connection by id; invite and resend mark it stale (invitations-listing.ts).
      __id
      filteredCount
      edges {
        node {
          ...invitationsTable_invitation
        }
      }
    }
  }
`;

/** "Show more" grows the block by this many. */
const SHOW_MORE_SIZE = 20;

interface InvitationsListTableProps {
  search: string;
  /** A deferred search is in flight: the rows on screen are the previous result. */
  isPending: boolean;
}

/**
 * Open invitations above the users: a few newest first, more on request, so a
 * pile of unanswered invites never pushes the people off the page. Owns the
 * `invitations` connection; the rows and their dialogs are `InvitationsTable`.
 */
export function InvitationsListTable({ search, isPending }: InvitationsListTableProps) {
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const variables = { search: search || null, first: INVITATIONS_PAGE_SIZE };
  const queryData = useLazyLoadQuery<invitationsListTableQuery>(invitationsListTableQueryNode, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    invitationsListTablePaginationQuery,
    invitationsListTable_query$key
  >(invitationsListTableFragment, queryData);
  const { invitations } = data;

  // A new invitation is the server's to place (does it match the search, where
  // does it sort): the mutation marks the listing stale and it is read again
  // here, without suspending the rows on screen — as many as are shown, so a
  // block opened with "Show more" stays open.
  useSubscribeToInvalidationState([invitations.__id], () => {
    const first = Math.max(invitations.edges.length, INVITATIONS_PAGE_SIZE);
    fetchQuery(environment, invitationsListTableQueryNode, { ...variables, first }, { fetchPolicy: 'network-only' })
      // The block keeps the rows it has; the next change asks again.
      .subscribe({ error: () => {} });
  });

  return (
    <InvitationsTable
      rows={invitations.edges.map(edge => edge.node)}
      totalCount={invitations.filteredCount}
      listingIds={affectedInvitationsListings(invitations.__id)}
      isPending={isPending}
    >
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
    </InvitationsTable>
  );
}
