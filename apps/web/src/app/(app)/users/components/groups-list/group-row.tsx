'use client';

import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type ColumnDef,
  DataTable,
  GRID_MIN_WIDTH,
  type Row,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { readInlineData } from 'react-relay';
import type { groupRowFields_group$key } from '@/__generated__/groupRowFields_group.graphql';
import { liveColumnMeta } from '@/app/components/shared';
import { openRowColumn } from '@/app/components/shared/open-row-column';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { groupRowFieldsFragment } from '@/graphql/directory/group-row-fields';
import { routes } from '@/lib/routes';
import { groupFeedTag } from '../../utils/user-presentation';

/** A row as its cells read it; every field but `id` is absent on a loading row. */
export interface GroupRow {
  id: string;
  href?: string;
  name?: string;
  provider?: string;
  tenant?: string;
  memberCount?: number;
  feed?: string;
}

/** `customerId`: the customer the list belongs to, kept for the group page's Back and its member scope. */
export function toGroupRow(ref: groupRowFields_group$key, customerId?: string): GroupRow {
  const node = readInlineData(groupRowFieldsFragment, ref);
  return {
    id: node.id,
    href: routes.customers.group(node.id, { customerId }),
    name: node.name,
    provider: node.provider,
    tenant: node.connection.name,
    memberCount: node.memberCount,
    feed: node.feed,
  };
}

const GROUP_COLUMNS = {
  group: { id: 'group', width: 'flex-1 min-w-0' },
  // A phone keeps the group and its feed (Figma 899:27262, 1019:36571).
  members: { id: 'members', header: 'Members', width: 'flex-1 min-w-0', hideAt: 'md' },
  feed: { id: 'feed', header: 'Feed', width: 'flex-none content-md:flex-1 content-md:min-w-0' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export const MEMBERS_COLUMN_ID = GROUP_COLUMNS.members.id;

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

/** GROUP column in the grid layout: one line, the provider's mark, the name, then the tenant. */
function GroupGridCell({ row }: { row: GroupRow }) {
  const mark = row.provider ? providerMark(row.provider) : null;
  return (
    <DataTable.Cell
      leading={mark ? { type: 'icon', icon: <mark.Logo size={20} role="img" aria-label={mark.label} /> } : undefined}
      // A row still being read has no name: the cell draws it as a bar.
      text={row.name ?? ''}
      secondary={row.tenant}
    />
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

/**
 * The columns of a group list; `sortable` draws the Members sort (a customer's groups, not a user's).
 *
 * Each data column also states what the grid layout reads: a `size` (its designed width), and for the group a `label`
 * (its header differs by host) and a one-line `gridCell`. Members and Feed are one line already.
 */
export function groupColumns({
  groupHeader,
  sortable = false,
}: {
  groupHeader: string;
  sortable?: boolean;
}): ColumnDef<GroupRow>[] {
  return [
    {
      id: GROUP_COLUMNS.group.id,
      header: groupHeader,
      cell: ({ row }: { row: Row<GroupRow> }) => <GroupCell row={row.original} />,
      enableSorting: false,
      size: 340,
      minSize: GRID_MIN_WIDTH.icon,
      meta: liveColumnMeta(GROUP_COLUMNS.group, {
        label: 'Group',
        gridCell: ({ row }: { row: Row<GroupRow> }) => <GroupGridCell row={row.original} />,
      }),
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
      size: 140,
      meta: liveColumnMeta({ ...GROUP_COLUMNS.members, sortable }),
    },
    {
      id: GROUP_COLUMNS.feed.id,
      header: GROUP_COLUMNS.feed.header,
      cell: ({ row }: { row: Row<GroupRow> }) => <FeedCell row={row.original} />,
      enableSorting: false,
      size: 180,
      meta: liveColumnMeta(GROUP_COLUMNS.feed),
    },
    openRowColumn<GroupRow>(GROUP_COLUMNS.open, row => ({
      label: `Open ${row.name ?? 'group'} in new tab`,
      href: row.href,
    })),
  ];
}

export const getGroupRowId = (row: GroupRow) => row.id;
export const groupRowHref = (row: GroupRow) => row.href ?? null;
