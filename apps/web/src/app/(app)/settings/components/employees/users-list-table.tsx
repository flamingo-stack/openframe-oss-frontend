'use client';

import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { usersListTable_query$key } from '@/__generated__/usersListTable_query.graphql';
import type { usersListTablePaginationQuery } from '@/__generated__/usersListTablePaginationQuery.graphql';
import type { usersListTableQuery } from '@/__generated__/usersListTableQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type EmployeeSelections, toUserFilter } from './employee-filters';
import { USERS_PAGE_SIZE } from './employees-columns';
import { UsersTable } from './users-table';

const usersListTableQueryNode = graphql`
  query usersListTableQuery($filter: UserFilterInput, $search: String, $first: Int!) {
    ...usersListTable_query @arguments(filter: $filter, search: $search, first: $first)
  }
`;

const usersListTableFragment = graphql`
  fragment usersListTable_query on Query
  @refetchable(queryName: "usersListTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "UserFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  ) {
    users(filter: $filter, search: $search, first: $first, after: $after) @connection(key: "usersListTable_users") {
      filteredCount
      edges {
        node {
          ...usersTable_user
        }
      }
    }
  }
`;

interface UsersListTableProps {
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
 * The tenant's `users` connection, searched, narrowed and paged on the server.
 * Owns the query and the infinite scroll; the rows are `UsersTable`. Suspends on
 * the first page.
 */
export function UsersListTable({
  search,
  backendSelections,
  selections,
  onSelectionsChange,
  isPending,
  stickyHeaderOffset,
}: UsersListTableProps) {
  const retryKey = useRetryKey();
  const filter = toUserFilter(backendSelections);
  const queryData = useLazyLoadQuery<usersListTableQuery>(
    usersListTableQueryNode,
    { filter, search: search || null, first: USERS_PAGE_SIZE },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    usersListTablePaginationQuery,
    usersListTable_query$key
  >(usersListTableFragment, queryData);

  return (
    <UsersTable
      rows={data.users.edges.map(edge => edge.node)}
      totalCount={data.users.filteredCount}
      search={search}
      isFiltered={filter !== null}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
      infiniteScroll={{
        hasNextPage: hasNext,
        isFetchingNextPage: isLoadingNext,
        onLoadMore: () => {
          if (hasNext && !isLoadingNext) loadNext(USERS_PAGE_SIZE);
        },
      }}
    />
  );
}
