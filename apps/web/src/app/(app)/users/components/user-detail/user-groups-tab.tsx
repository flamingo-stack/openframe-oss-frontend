'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  type AutoRefreshControlProps,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  type CursorPagerFooterProps,
  type CursorPagerVariables,
  useCursorPager,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { userGroupsTabQuery as UserGroupsTabQueryType } from '@/__generated__/userGroupsTabQuery.graphql';
import { oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { forwardPage } from '@/app/hooks/forward-page';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { getGroupRowId, type GroupRow, groupColumns, groupRowHref, toGroupRow } from '../groups-list/group-row';
import { UserTabHeading } from './user-tab-heading';

const GROUPS_PAGE_SIZE = 20;

/**
 * The tab's URL prefix: it shares the user page's query string with the Devices and Licences tabs (`devices…`,
 * `licences…`), so its pager sits under `groups…` (`groupsCursor`, `groupsPage`, `groupsRefresh`).
 */
const PARAM_PREFIX = 'groups';

/**
 * The account's groups, one page per request, its cursor in the URL (no `@connection`: a cursor from a link must read
 * exactly its page). `groups` pages forward only (`first` / `after`, `PAGED_LISTS.accountGroups`).
 *
 * Through `directoryAccount`, the account in `?id=` itself: `directoryUser(id).accounts` is every account the person
 * holds. Direct membership, stored.
 */
const userGroupsTabQuery = graphql`
  query userGroupsTabQuery($id: ID!, $first: Int!, $after: String) {
    directoryAccount(id: $id) {
      groups(first: $first, after: $after) {
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
  }
`;

// Figma 1014:2086 heads it "USER" (To Design T1): it lists groups.
const COLUMNS = groupColumns({ groupHeader: 'Group' });

/** The heading and the table, from the rows it is handed (`null` while they are read). */
function GroupsTable({
  rows,
  totalCount,
  pager,
  refresh,
  isPending,
}: {
  rows: readonly GroupRow[] | null;
  /** The server's total, not the rows on the page. */
  totalCount: number;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
  /** The next page is being read and the rows on screen are the previous one's. */
  isPending: boolean;
}) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('user-groups');
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
        {...tableGrid}
        table={table}
        pageSize={GROUPS_PAGE_SIZE}
        loadingCells={loading}
        stickyHeader={false}
        itemName="result"
        totalCount={totalCount}
        isPending={isPending}
        emptyState={oneLineEmptyState('This user is in no groups.')}
        rowHref={groupRowHref}
        pager={pager}
        refresh={refresh}
      />
    </div>
  );
}

interface UserGroupsPageProps {
  id: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The next page is being read and the rows on screen are the previous one's. */
  isPending: boolean;
}

/**
 * User page → Groups (Figma 1014:2086), one page at a time with First · Prev · Next. Owns the tab's pager (in the URL,
 * under the tab's prefix); the rows suspend below it. `memo`'d: `TabNavigation` defers the body.
 */
export const UserGroupsTab = memo(function UserGroupsTabImpl({
  id,
  loading = false,
}: {
  id: string;
  loading?: boolean;
}) {
  const pager = useCursorPager({ prefix: PARAM_PREFIX, pageSize: GROUPS_PAGE_SIZE, ...PAGED_LISTS.accountGroups });
  // The page is deferred: the rows on screen stay, dimmed, while the next page is read.
  const { deferredPage, isPending } = useDeferredQuery(null, '', pager.variables);
  return (
    <UserGroupsBoundary id={id} loading={loading} pager={pager} pageVariables={deferredPage} isPending={isPending} />
  );
});

/**
 * The rows' boundaries. A cursor the server refuses drops to the first page (`StaleCursorBoundary`); any other error
 * goes up unchanged.
 */
function UserGroupsBoundary(props: UserGroupsPageProps & { loading: boolean }) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <UserGroupsLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function UserGroupsLoading({ loading, ...props }: UserGroupsPageProps & { loading: boolean }) {
  return (
    <LoadingSuspense live label="Loading groups" gated={loading}>
      <UserGroupsReader {...props} />
    </LoadingSuspense>
  );
}

function UserGroupsReader(props: UserGroupsPageProps) {
  if (useLoadingScope()) return <GroupsTable rows={null} totalCount={0} pager={null} isPending={false} />;
  return <UserGroupsQuery {...props} />;
}

/** The page the URL names, its footer and the auto-refresh. */
function UserGroupsQuery({ id, pager, pageVariables, isPending }: UserGroupsPageProps) {
  const retryKey = useRetryKey();
  const variables: UserGroupsTabQueryType['variables'] = { id, ...forwardPage(pageVariables, GROUPS_PAGE_SIZE) };
  const queryData = useLazyLoadQuery<UserGroupsTabQueryType>(userGroupsTabQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<UserGroupsTabQueryType>(userGroupsTabQuery, variables);

  const groups = queryData.directoryAccount?.groups;
  const rows = useMemo(() => (groups ? groups.edges.map(edge => toGroupRow(edge.node)) : null), [groups]);
  const paged = usePagedTable({
    pager,
    pageInfo: groups?.pageInfo,
    rowCount: groups?.edges.length ?? 0,
    prefix: PARAM_PREFIX,
    refetch,
    isPending,
  });
  // A missing account is the header's to say ("User not found").
  if (!groups || !rows) return null;

  return (
    <GroupsTable
      rows={rows}
      totalCount={groups.totalCount}
      pager={paged.pager}
      refresh={paged.refresh}
      isPending={isPending}
    />
  );
}
