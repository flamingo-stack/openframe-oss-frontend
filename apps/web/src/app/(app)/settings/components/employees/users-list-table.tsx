'use client';

import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { usersListTable_query$key } from '@/__generated__/usersListTable_query.graphql';
import type { usersListTablePaginationQuery } from '@/__generated__/usersListTablePaginationQuery.graphql';
import type { usersListTableQuery } from '@/__generated__/usersListTableQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { USERS_PAGE_SIZE } from './employees-columns';
import { UsersTable } from './users-table';

const usersListTableQueryNode = graphql`
  query usersListTableQuery($search: String, $first: Int!) {
    ...usersListTable_query @arguments(search: $search, first: $first)
  }
`;

const usersListTableFragment = graphql`
  fragment usersListTable_query on Query
  @refetchable(queryName: "usersListTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  ) {
    users(search: $search, first: $first, after: $after) @connection(key: "usersListTable_users") {
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
  /** The deferred search lags the box: the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
}

/**
 * The tenant's `users` connection, searched and paged on the server. Owns the
 * query and the infinite scroll; the rows are `UsersTable`. Suspends on the
 * first page.
 */
export function UsersListTable({ search, isPending, stickyHeaderOffset }: UsersListTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<usersListTableQuery>(
    usersListTableQueryNode,
    { search: search || null, first: USERS_PAGE_SIZE },
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
