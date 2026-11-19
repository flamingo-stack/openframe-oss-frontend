'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
import { NO_ITEMS, NO_NEXT_PAGE, useRetryKey } from '@/app/components/shared';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import {
  type EmployeeSelections,
  invitationFilterOptions,
  NO_EMPLOYEE_FILTER_OPTIONS,
  toInvitationFilter,
} from './employee-filters';
import { INVITATIONS_PAGE_SIZE } from './employees-columns';
import { affectedInvitationsListings, invitationsListingId } from './invitations-listing';
import { InvitationsTable } from './invitations-table';

const invitationsListTableQueryNode = graphql`
  query invitationsListTableQuery($filter: InvitationFilterInput, $search: String, $first: Int!) {
    ...invitationsListTable_query @arguments(filter: $filter, search: $search, first: $first)
    # Beside the fragment, not in it: the next page does not count the funnels again.
    invitationFilters(filter: $filter, search: $search) {
      ...employeeFilters_invitationFilters
    }
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
  /** A deferred search or funnel lags its control: the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
}

/**
 * Open invitations, newest first, searched, narrowed and paged on the server, with their own boundary. In a loading
 * scope (the boundary's fallback) the reader draws the table over one page of placeholder rows with their real cells;
 * otherwise it runs the query, which suspends under that boundary.
 *
 * The table's layout is the app's one table flag: the grid where it is on, card rows where it is off. Until the flag
 * is answered the list is a loading scope, so one table is never drawn and then replaced by the other.
 */
export function InvitationsListTable(props: InvitationsListTableProps) {
  const tableGate = useTableGridGate();
  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <LoadingSuspense label="Loading invitations">
        <InvitationsListReader {...props} layout={tableLayoutFor(tableGate)} />
      </LoadingSuspense>
    </LoadingWhen>
  );
}

/** What the reader and the query take: the listing's props and the layout both of their tables draw. */
type InvitationsListReaderProps = InvitationsListTableProps & { layout: TableLayout };

function InvitationsListReader(props: InvitationsListReaderProps) {
  if (useLoadingScope()) {
    return (
      <InvitationsTable
        rows={NO_ITEMS}
        totalCount={0}
        search={props.search}
        isFiltered={false}
        filterOptions={NO_EMPLOYEE_FILTER_OPTIONS}
        selections={props.selections}
        onSelectionsChange={props.onSelectionsChange}
        listingIds={affectedInvitationsListings(invitationsListingId(props.search))}
        isPending={false}
        stickyHeaderOffset={props.stickyHeaderOffset}
        infiniteScroll={NO_NEXT_PAGE}
        layout={props.layout}
      />
    );
  }
  return <InvitationsListQuery {...props} />;
}

/** The first page, the infinite scroll and the refetch a change marks stale. */
function InvitationsListQuery({
  search,
  backendSelections,
  selections,
  onSelectionsChange,
  isPending,
  stickyHeaderOffset,
  layout,
}: InvitationsListReaderProps) {
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
  // sort), and every change moves the funnels' numbers: the mutations mark the
  // listing stale and it is read again here, with the funnels,
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
      filterOptions={invitationFilterOptions(queryData.invitationFilters, selections)}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      listingIds={affectedInvitationsListings(invitations.__id)}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
      layout={layout}
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
