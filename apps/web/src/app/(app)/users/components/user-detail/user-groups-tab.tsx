'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useDataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { userGroupsTab_query$key } from '@/__generated__/userGroupsTab_query.graphql';
import type { userGroupsTabPaginationQuery as UserGroupsTabPaginationQueryType } from '@/__generated__/userGroupsTabPaginationQuery.graphql';
import type { userGroupsTabQuery as UserGroupsTabQueryType } from '@/__generated__/userGroupsTabQuery.graphql';
import { type InfiniteScroll, NO_NEXT_PAGE, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { getGroupRowId, type GroupRow, groupColumns, groupRowHref, toGroupRow } from '../groups-list/group-row';
import { UserTabHeading } from './user-tab-heading';

const GROUPS_PAGE_SIZE = 20;

const userGroupsTabQuery = graphql`
  query userGroupsTabQuery($id: ID!, $first: Int!, $after: String) {
    ...userGroupsTab_query @arguments(id: $id, first: $first, after: $after)
  }
`;

// Through `directoryAccount`, not `directoryUser(id).accounts`: Relay cannot page a connection inside a plural field,
// and `DirectoryAccount` is not a Node (contract v0.3 §1). Direct membership, stored.
const userGroupsTabFragment = graphql`
  fragment userGroupsTab_query on Query
  @refetchable(queryName: "userGroupsTabPaginationQuery")
  @argumentDefinitions(id: { type: "ID!" }, first: { type: "Int", defaultValue: 20 }, after: { type: "String" }) {
    directoryAccount(id: $id) {
      groups(first: $first, after: $after) @connection(key: "userGroupsTab_groups") {
        totalCount
        edges {
          node {
            ...groupRowFields_group
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

// Figma 1014:2086 heads it "USER" (To Design T1): it lists groups.
const COLUMNS = groupColumns({ groupHeader: 'Group' });

/** The heading and the table, from the rows it is handed (`null` while they are read). */
function GroupsTable({
  rows,
  totalCount,
  infiniteScroll,
}: {
  rows: readonly GroupRow[] | null;
  totalCount: number;
  infiniteScroll: InfiniteScroll;
}) {
  const loading = useLoadingScope();
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<GroupRow>(GROUPS_PAGE_SIZE) : null),
    [loading],
  );
  const table = useDataTable<GroupRow>({
    data: placeholderRows ?? ((rows ?? []) as GroupRow[]),
    columns: COLUMNS,
    getRowId: getGroupRowId,
    enableSorting: false,
  });
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <UserTabHeading title="Groups" />
      <LiveTable
        table={table}
        pageSize={GROUPS_PAGE_SIZE}
        loadingCells={loading}
        stickyHeader={false}
        itemName="result"
        totalCount={totalCount}
        emptyState={oneLineEmptyState('This user is in no groups.')}
        rowHref={groupRowHref}
        footer={rows && rows.length > 0 ? infiniteScroll : null}
      />
    </div>
  );
}

/** User page → Groups (Figma 1014:2086). `memo`'d: `TabNavigation` defers the body. */
export const UserGroupsTab = memo(function UserGroupsTabImpl({
  id,
  loading = false,
}: {
  id: string;
  loading?: boolean;
}) {
  return (
    <LoadingSuspense live label="Loading groups" gated={loading}>
      <UserGroupsReader id={id} />
    </LoadingSuspense>
  );
});

function UserGroupsReader({ id }: { id: string }) {
  if (useLoadingScope()) return <GroupsTable rows={null} totalCount={0} infiniteScroll={NO_NEXT_PAGE} />;
  return <UserGroupsQuery id={id} />;
}

function UserGroupsQuery({ id }: { id: string }) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<UserGroupsTabQueryType>(
    userGroupsTabQuery,
    { id, first: GROUPS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    UserGroupsTabPaginationQueryType,
    userGroupsTab_query$key
  >(userGroupsTabFragment, queryData);

  const groups = data.directoryAccount?.groups;
  const rows = useMemo(() => (groups ? groups.edges.map(edge => toGroupRow(edge.node)) : null), [groups]);
  // A missing account is the header's to say ("User not found").
  if (!groups || !rows) return null;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(GROUPS_PAGE_SIZE);
  };
  return (
    <GroupsTable
      rows={rows}
      totalCount={groups.totalCount}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}
