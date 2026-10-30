'use client';

import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type ColumnDef,
  type Row,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { readInlineData } from 'react-relay';
import type { groupRowFields_group$key } from '@/__generated__/groupRowFields_group.graphql';
import { liveColumnMeta } from '@/app/components/shared';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { groupRowFieldsFragment } from '@/graphql/directory/group-row-fields';
import { openInNewTab } from '@/lib/open-in-new-tab';
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

function FeedCell({ row }: { row: GroupRow }) {
  const loading = useLoadingScope();
  const tag = row.feed ? groupFeedTag(row.feed) : null;
  return (
    <div className="flex min-w-0 items-center">
      <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />
    </div>
  );
}

/** The columns of a group list; `sortable` draws the Members sort (a customer's groups, not a user's). */
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
      meta: liveColumnMeta({ ...GROUP_COLUMNS.members, sortable }),
    },
    {
      id: GROUP_COLUMNS.feed.id,
      header: GROUP_COLUMNS.feed.header,
      cell: ({ row }: { row: Row<GroupRow> }) => <FeedCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(GROUP_COLUMNS.feed),
    },
    {
      id: GROUP_COLUMNS.open.id,
      cell: ({ row }: { row: Row<GroupRow> }) => {
        const { href, name } = row.original;
        return (
          <OpenRowButton
            label={`Open ${name ?? 'group'} in new tab`}
            onClick={event => href && openInNewTab(href)(event)}
          />
        );
      },
      enableSorting: false,
      meta: liveColumnMeta(GROUP_COLUMNS.open),
    },
  ];
}

export const getGroupRowId = (row: GroupRow) => row.id;
export const groupRowHref = (row: GroupRow) => row.href ?? null;
