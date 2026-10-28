'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type ColumnDef,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { userGroupsTab_query$data, userGroupsTab_query$key } from '@/__generated__/userGroupsTab_query.graphql';
import type { userGroupsTabPaginationQuery as UserGroupsTabPaginationQueryType } from '@/__generated__/userGroupsTabPaginationQuery.graphql';
import type { userGroupsTabQuery as UserGroupsTabQueryType } from '@/__generated__/userGroupsTabQuery.graphql';
import {
  type InfiniteScroll,
  liveColumnMeta,
  NO_NEXT_PAGE,
  oneLineEmptyState,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { groupFeedTag } from '../../utils/user-presentation';
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
            id
            name
            provider
            memberCount
            feed
            connection {
              name
            }
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

type GroupNode = NonNullable<userGroupsTab_query$data['directoryAccount']>['groups']['edges'][number]['node'];

const GROUP_COLUMNS = {
  // Figma 1014:2086 heads it "USER" (To Design T1): it lists groups.
  group: { id: 'group', header: 'Group', width: 'flex-1 min-w-0' },
  // A phone keeps the group and its feed (Figma 1019:36571).
  members: { id: 'members', header: 'Members', width: 'flex-1 min-w-0', hideAt: 'md' },
  feed: { id: 'feed', header: 'Feed', width: 'flex-1 min-w-0' },
  // The rows open nothing until the group page (S4); the gutter keeps Figma's columns (1014:2149), a phone's row drops it.
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface GroupRow {
  id: string;
  name?: string;
  provider?: string;
  tenant?: string;
  memberCount?: number;
  feed?: string;
}

const toGroupRow = (node: GroupNode): GroupRow => ({
  id: node.id,
  name: node.name,
  provider: node.provider,
  tenant: node.connection.name,
  memberCount: node.memberCount,
  feed: node.feed,
});

function GroupCell({ row }: { row: GroupRow }) {
  const loading = useLoadingScope();
  const mark = row.provider ? providerMark(row.provider) : null;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {mark && <mark.Logo data-loading-optional size={24} role="img" aria-label={mark.label} />}
        <TruncateText className={loading ? 'w-32' : undefined}>{row.name ?? ''}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary" className={loading ? 'w-24' : undefined}>
        {row.tenant ?? ''}
      </TruncateText>
    </div>
  );
}

function FeedCell({ row }: { row: GroupRow }) {
  const loading = useLoadingScope();
  const tag = row.feed ? groupFeedTag(row.feed) : null;
  return (
    <div className="flex min-w-0 items-center">
      <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />
    </div>
  );
}

const COLUMNS: ColumnDef<GroupRow>[] = [
  {
    id: GROUP_COLUMNS.group.id,
    header: GROUP_COLUMNS.group.header,
    cell: ({ row }: { row: Row<GroupRow> }) => <GroupCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(GROUP_COLUMNS.group),
  },
  {
    id: GROUP_COLUMNS.members.id,
    header: GROUP_COLUMNS.members.header,
    cell: ({ row }: { row: Row<GroupRow> }) => (
      <TruncateText loading={row.original.memberCount === undefined}>
        {String(row.original.memberCount ?? 0)}
      </TruncateText>
    ),
    enableSorting: false,
    meta: liveColumnMeta(GROUP_COLUMNS.members),
  },
  {
    id: GROUP_COLUMNS.feed.id,
    header: GROUP_COLUMNS.feed.header,
    cell: ({ row }: { row: Row<GroupRow> }) => <FeedCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(GROUP_COLUMNS.feed),
  },
  { id: GROUP_COLUMNS.open.id, cell: () => null, enableSorting: false, meta: liveColumnMeta(GROUP_COLUMNS.open) },
];

const getRowId = (row: GroupRow) => row.id;

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
    getRowId,
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
