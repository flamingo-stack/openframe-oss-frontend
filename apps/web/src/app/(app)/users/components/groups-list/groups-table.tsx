'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { UsersGroupIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { CursorPagerFooterProps } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  DirectoryGroupOrderInput,
  groupsTableQuery as GroupsTableQueryType,
} from '@/__generated__/groupsTableQuery.graphql';
import { EmptyState, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { forwardPage } from '@/app/hooks/forward-page';
import { type PagedListPosition, usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { DirectoryGroupSortField, SortDirection } from '@/generated/schema-enums';
import { useListRefreshEpoch } from '@/lib/list-refresh';
import { getGroupRowId, type GroupRow, groupColumns, groupRowHref, MEMBERS_COLUMN_ID, toGroupRow } from './group-row';

export const GROUPS_PAGE_SIZE = 20;

/**
 * Groups that touch the customer: named by one of its GROUP rules, or with one of its visible users as a direct member.
 * One page per request, its cursor in the URL (no `@connection`: a cursor from a link must read exactly its page).
 * `directoryGroups` pages forward only (`first` / `after`, `PAGED_LISTS.directoryGroups`).
 */
const groupsTableQuery = graphql`
  query groupsTableQuery(
    $organizationId: ID!
    $search: String
    $orderBy: DirectoryGroupOrderInput
    $first: Int!
    $after: String
  ) {
    directoryGroups(organizationId: $organizationId, search: $search, orderBy: $orderBy, first: $first, after: $after) {
      totalCount
      edges {
        node {
          ...groupRowFields_group
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

interface GroupsTableProps {
  organizationId: string;
  /** Deferred sort: feeds the query. */
  orderBy: DirectoryGroupOrderInput | null;
  /** Deferred — the URL's search (never the box's: the write that carries a new search drops the cursor). */
  debouncedSearch: string;
  /** Live sort: what the header draws, so a click lands instantly. */
  membersSort: 'asc' | 'desc' | null;
  onToggleMembersSort: () => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** No group at all (not a search miss): the view drops its title and toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL, under the view's prefix (`groups`: the auto-refresh interval is `groupsRefresh`). */
  position: PagedListPosition;
}

/**
 * A customer's groups, with their own boundary; in its scope the reader draws placeholder rows and does not fetch. A
 * cursor the server refuses drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
export function GroupsTable(props: GroupsTableProps) {
  return (
    <StaleCursorBoundary
      cursor={readCursor(props.position.pageVariables)}
      onStaleCursor={props.position.pager.dropCursor}
    >
      <GroupsTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function GroupsTableLoading(props: GroupsTableProps) {
  return (
    <LoadingSuspense label="Loading groups">
      <GroupsTableReader {...props} />
    </LoadingSuspense>
  );
}

function GroupsTableReader(props: GroupsTableProps) {
  if (useLoadingScope()) {
    return <GroupsRows {...props} rows={NO_ITEMS} totalCount={0} pager={null} />;
  }
  return <GroupsTableQuery {...props} />;
}

/**
 * The page the URL names, its footer and the auto-refresh. A change marked on `directoryGroups` reads the page again
 * (`useListRefreshEpoch`), keeping the rows on screen until it arrives.
 */
function GroupsTableQuery({ position, ...props }: GroupsTableProps) {
  const { pager, pageVariables, paramPrefix } = position;
  const { organizationId, orderBy, debouncedSearch, isPending } = props;
  const retryKey = useRetryKey();
  const changed = useListRefreshEpoch('directoryGroups');
  const variables: GroupsTableQueryType['variables'] = {
    organizationId,
    search: debouncedSearch || null,
    orderBy,
    ...forwardPage(pageVariables, GROUPS_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<GroupsTableQueryType>(groupsTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${changed}`,
  });
  const refetch = useRefetchPage<GroupsTableQueryType>(groupsTableQuery, variables);

  const { edges, totalCount, pageInfo } = queryData.directoryGroups;
  const rows = useMemo(() => edges.map(edge => toGroupRow(edge.node, organizationId)), [edges, organizationId]);
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, prefix: paramPrefix, refetch, isPending });
  return <GroupsRows {...props} rows={rows} totalCount={totalCount} pager={paged.pager} refresh={paged.refresh} />;
}

const COLUMNS = groupColumns({ groupHeader: 'Groups', sortable: true });

interface GroupsRowsProps extends Omit<GroupsTableProps, 'position'> {
  rows: readonly GroupRow[];
  /** The server's total for the search, not the rows on the page. */
  totalCount: number;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function GroupsRows({
  rows,
  totalCount,
  pager,
  refresh,
  debouncedSearch,
  membersSort,
  onToggleMembersSort,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: GroupsRowsProps) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('groups');
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

  // A search that finds nothing keeps the table; no group at all gets the page's empty state (Figma 882:74714). An
  // empty LATER page (a cursor about to be dropped) keeps the table and its pager.
  const isFirstPage = pager?.isFirstPage ?? true;
  const showEmptyState = !loading && !debouncedSearch && !isPending && isFirstPage && rows.length === 0;
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
      {...tableGrid}
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
      pager={pager}
      refresh={refresh}
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
