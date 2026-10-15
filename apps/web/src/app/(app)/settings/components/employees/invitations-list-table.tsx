'use client';

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
import { type EmployeeSelections, toInvitationFilter } from './employee-filters';
import { INVITATIONS_PAGE_SIZE } from './employees-columns';
import { affectedInvitationsListings } from './invitations-listing';
import { InvitationsTable } from './invitations-table';

const invitationsListTableQueryNode = graphql`
  query invitationsListTableQuery($filter: InvitationFilterInput, $search: String, $first: Int!) {
    ...invitationsListTable_query @arguments(filter: $filter, search: $search, first: $first)
  }
`;

const invitationsListTableFragment = graphql`
  fragment invitationsListTable_query on Query
  @refetchable(queryName: "invitationsListTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "InvitationFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    invitations(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "invitationsListTable_invitations") {
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

interface InvitationsListTableProps {
  search: string;
  /** Deferred funnels — feed the query (lag the live ones during a refetch). */
  backendSelections: EmployeeSelections;
  /** Live funnels — what the headers draw as ticked, so a tick lands instantly. */
  selections: EmployeeSelections;
  onSelectionsChange: (next: EmployeeSelections) => void;
  /** Other records counting these invitations (the tab bar's), kept in step with the table's own. */
  countIds: readonly string[];
  /** A deferred search or funnel lags its control: the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
}

/**
 * Open invitations, newest first, searched, narrowed and paged on the server.
 * Owns the `invitations` connection and the infinite scroll; the rows and their
 * dialogs are `InvitationsTable`. Suspends on the first page.
 */
export function InvitationsListTable({
  search,
  backendSelections,
  selections,
  onSelectionsChange,
  countIds,
  isPending,
  stickyHeaderOffset,
}: InvitationsListTableProps) {
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const filter = toInvitationFilter(backendSelections);
  const variables = { filter, search: search || null, first: INVITATIONS_PAGE_SIZE };
  const queryData = useLazyLoadQuery<invitationsListTableQuery>(invitationsListTableQueryNode, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    invitationsListTablePaginationQuery,
    invitationsListTable_query$key
  >(invitationsListTableFragment, queryData);
  const { invitations } = data;

  // A new invitation is the server's to place (does it match, where does it
  // sort): the mutation marks the listing stale and it is read again here,
  // without suspending the rows on screen — as many as are loaded, so a scrolled
  // table keeps its length.
  useSubscribeToInvalidationState([invitations.__id], () => {
    const first = Math.max(invitations.edges.length, INVITATIONS_PAGE_SIZE);
    fetchQuery(environment, invitationsListTableQueryNode, { ...variables, first }, { fetchPolicy: 'network-only' })
      // The table keeps the rows it has; the next change asks again.
      .subscribe({ error: () => {} });
  });

  return (
    <InvitationsTable
      rows={invitations.edges.map(edge => edge.node)}
      totalCount={invitations.filteredCount}
      search={search}
      isFiltered={filter !== null}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      listingIds={[...affectedInvitationsListings(invitations.__id), ...countIds]}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
      infiniteScroll={{
        hasNextPage: hasNext,
        isFetchingNextPage: isLoadingNext,
        onLoadMore: () => {
          if (hasNext && !isLoadingNext) loadNext(INVITATIONS_PAGE_SIZE);
        },
      }}
    />
  );
}
