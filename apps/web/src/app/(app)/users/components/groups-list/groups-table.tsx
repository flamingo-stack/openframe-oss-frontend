'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { UsersGroupIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useDataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { groupsTable_query$key } from '@/__generated__/groupsTable_query.graphql';
import type { groupsTablePaginationQuery as GroupsTablePaginationQueryType } from '@/__generated__/groupsTablePaginationQuery.graphql';
import type {
  DirectoryGroupOrderInput,
  groupsTableQuery as GroupsTableQueryType,
} from '@/__generated__/groupsTableQuery.graphql';
import {
  EmptyState,
  type InfiniteScroll,
  NO_ITEMS,
  NO_NEXT_PAGE,
  oneLineEmptyState,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { DirectoryGroupSortField, SortDirection } from '@/generated/schema-enums';
import { getGroupRowId, type GroupRow, groupColumns, groupRowHref, MEMBERS_COLUMN_ID, toGroupRow } from './group-row';

const GROUPS_PAGE_SIZE = 20;

const groupsTableQuery = graphql`
  query groupsTableQuery(
    $organizationId: ID!
    $search: String
    $orderBy: DirectoryGroupOrderInput
    $first: Int!
    $after: String
  ) {
    ...groupsTable_query
      @arguments(organizationId: $organizationId, search: $search, orderBy: $orderBy, first: $first, after: $after)
  }
`;

// Groups that touch the customer: named by one of its GROUP rules, or with one of its visible users as a direct member.
const groupsTableFragment = graphql`
  fragment groupsTable_query on Query
  @refetchable(queryName: "groupsTablePaginationQuery")
  @argumentDefinitions(
    organizationId: { type: "ID!" }
    search: { type: "String" }
    orderBy: { type: "DirectoryGroupOrderInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryGroups(organizationId: $organizationId, search: $search, orderBy: $orderBy, first: $first, after: $after)
      @connection(key: "groupsTable_directoryGroups") {
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
`;

interface GroupsTableProps {
  organizationId: string;
  /** Deferred sort: feeds the query. */
  orderBy: DirectoryGroupOrderInput | null;
  debouncedSearch: string;
  /** Live sort: what the header draws, so a click lands instantly. */
  membersSort: 'asc' | 'desc' | null;
  onToggleMembersSort: () => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** No group at all (not a search miss): the view drops its title and toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** A customer's groups, with their own boundary; in its scope the reader draws placeholder rows and does not fetch. */
export function GroupsTable(props: GroupsTableProps) {
  return (
    <LoadingSuspense label="Loading groups">
      <GroupsTableReader {...props} />
    </LoadingSuspense>
  );
}

function GroupsTableReader(props: GroupsTableProps) {
  if (useLoadingScope()) {
    return <GroupsRows {...props} rows={NO_ITEMS} totalCount={0} infiniteScroll={NO_NEXT_PAGE} />;
  }
  return <GroupsTableQuery {...props} />;
}

function GroupsTableQuery(props: GroupsTableProps) {
  const { organizationId, orderBy, debouncedSearch } = props;
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<GroupsTableQueryType>(
    groupsTableQuery,
    { organizationId, search: debouncedSearch || null, orderBy, first: GROUPS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    GroupsTablePaginationQueryType,
    groupsTable_query$key
  >(groupsTableFragment, queryData);

  const { edges, totalCount } = data.directoryGroups;
  const rows = useMemo(() => edges.map(edge => toGroupRow(edge.node, organizationId)), [edges, organizationId]);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(GROUPS_PAGE_SIZE);
  };
  return (
    <GroupsRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

const COLUMNS = groupColumns({ groupHeader: 'Groups', sortable: true });

function GroupsRows({
  rows,
  totalCount,
  infiniteScroll,
  debouncedSearch,
  membersSort,
  onToggleMembersSort,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: GroupsTableProps & { rows: readonly GroupRow[]; totalCount: number; infiniteScroll: InfiniteScroll }) {
  const loading = useLoadingScope();
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<GroupRow>(GROUPS_PAGE_SIZE) : null),
    [loading],
  );
  const table = useDataTable<GroupRow>({
    data: placeholderRows ?? (rows as GroupRow[]),
    columns: COLUMNS,
    getRowId: getGroupRowId,
    enableSorting: false,
  });

  // A search that finds nothing keeps the table; no group at all gets the page's empty state (Figma 882:74714).
  const showEmptyState = !loading && !debouncedSearch && !isPending && rows.length === 0;
  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<UsersGroupIcon />}
        title="No groups yet"
        description="This customer’s groups will appear here."
      />
    );
  }
  return (
    <LiveTable
      table={table}
      pageSize={GROUPS_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      isPending={isPending}
      sort={membersSort ? { id: MEMBERS_COLUMN_ID, desc: membersSort === 'desc' } : null}
      onSortChange={onToggleMembersSort}
      emptyState={oneLineEmptyState(`No groups found matching "${debouncedSearch}". Try adjusting your search.`)}
      rowHref={groupRowHref}
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}

export function membersOrderBy(sort: 'asc' | 'desc' | null): DirectoryGroupOrderInput | null {
  if (!sort) return null;
  return {
    field: DirectoryGroupSortField.MEMBERS,
    direction: sort === 'desc' ? SortDirection.DESC : SortDirection.ASC,
  };
}
