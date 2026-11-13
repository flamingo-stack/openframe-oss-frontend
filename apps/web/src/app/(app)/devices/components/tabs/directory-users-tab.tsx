'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter02Icon, UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type DataTableFilterOption,
  type DataTableSettings,
  type FilterGroup,
  FilterModal,
  FloatingTooltip,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type Row,
  SquareAvatar,
  Tag,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  directoryUsersTabQuery$data,
  directoryUsersTabQuery as DirectoryUsersTabQueryType,
} from '@/__generated__/directoryUsersTabQuery.graphql';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { UserTabHeading } from '@/app/(app)/users/components/user-detail/user-tab-heading';
import {
  CustomerCell,
  FirstPlusCountCell,
  ProviderMarks,
  StatusCell,
  UserCell,
  type UserRow,
} from '@/app/(app)/users/components/users-list/user-row-cells';
import {
  firstAndCount,
  groupRefName,
  lastSignInLabel,
  userStatusTag,
  userStatusTooltip,
} from '@/app/(app)/users/utils/user-presentation';
import { liveColumnMeta, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { DirectoryDeviceUserLink } from '@/generated/schema-enums';
import { toAccountRow } from '@/graphql/directory/account-row-fields';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { Device } from '../../types/device.types';
import { TabEmptyState } from './tab-empty-state';

/** Stored values only: `users` costs no provider call, unlike the Directory tab's `cards` (contract §6). */
const directoryUsersTabQuery = graphql`
  query directoryUsersTabQuery($machineId: ID!) {
    deviceDirectory(machineId: $machineId) {
      users {
        link
        groups {
          id
          name
        }
        account {
          ...accountRowFields_account
          status
          statusReason
          statusDetail
          lastSignInAt
          signInData
          connection {
            name
            provider
          }
        }
      }
    }
  }
`;

type DirectoryUser = directoryUsersTabQuery$data['deviceDirectory']['users'][number];

const COLUMNS_LAYOUT = {
  user: { id: 'user', header: 'User', width: 'flex-[2] min-w-0' },
  status: { id: 'status', header: 'Status', width: 'flex-none content-md:w-44 content-md:shrink-0' },
  customer: { id: 'customer', header: 'Customer', width: 'flex-[2] min-w-0', hideAt: 'md' },
  // A row's groups, "first +N" (Figma 1374:241).
  group: { id: 'group', header: 'Group', width: 'w-40 shrink-0', hideAt: 'lg' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

interface Selections {
  status: string[];
  customer: string[];
  group: string[];
}

const NO_SELECTIONS: Selections = { status: [], customer: [], group: [] };

function toRow({ account, link, groups }: DirectoryUser): UserRow {
  return {
    ...toAccountRow(account),
    roleTag: link === DirectoryDeviceUserLink.DECLARED ? 'Primary user' : null,
    tenant: account.connection,
    status: userStatusTag(account.status),
    statusTooltip: userStatusTooltip(account.statusReason, account.statusDetail),
    lastSignIn: lastSignInLabel(account.lastSignInAt, account.signInData, 'relative'),
    groups: groups.map(groupRefName),
  };
}

/** What each funnel narrows on, for one row. */
const FACETS: Record<keyof Selections, (row: UserRow) => readonly string[]> = {
  status: row => (row.status ? [row.status.label] : []),
  customer: row => (row.customers ?? []).map(customer => customer.name),
  group: row => row.groups ?? [],
};

/** The list is read whole (the field takes no filter), so its funnels narrow here. Values in one block are OR'ed. */
function matches(row: UserRow, selections: Selections): boolean {
  return (Object.keys(FACETS) as (keyof Selections)[]).every(key => {
    const picked = selections[key];
    return picked.length === 0 || FACETS[key](row).some(value => picked.includes(value));
  });
}

function matchesSearch(row: UserRow, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return `${row.name ?? ''} ${row.email ?? ''}`.toLowerCase().includes(needle);
}

/** Each option once, counted under the search and the other funnels, as the server's facets count. */
function facetOptions(
  rows: readonly UserRow[],
  selections: Selections,
  key: keyof Selections,
): DataTableFilterOption[] {
  const others = { ...selections, [key]: [] };
  const counts = new Map<string, number>();
  for (const row of rows.filter(item => matches(item, others))) {
    for (const value of new Set(FACETS[key](row))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ id: value, label: value, value, count }));
}

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order, resized
 * widths) kept in the browser under this table's own key.
 */
const DIRECTORY_USERS_TABLE_SETTINGS: DataTableSettings = { storageKey: 'device-directory-users' };

/**
 * The grid's one line of `UserCell`: the avatar, the provider marks, the name, its role tag, then the email. The avatar
 * and the marks sit before the cell (a cell has one leading mark), on the same line.
 */
function UserGridCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const name = row.name ?? '';
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <SquareAvatar alt={name} fallback={name} size="sm" variant="round" loading={loading} />
      <ProviderMarks providers={row.providers ?? []} />
      <DataTable.Cell
        text={name}
        tag={row.roleTag ? <Tag label={row.roleTag} variant="grey" /> : undefined}
        secondary={loading ? undefined : row.email === null ? EMPTY_VALUE : (row.email ?? undefined)}
      />
    </div>
  );
}

/** The grid's one line of `StatusCell`: the status tag (its reason on hover), then the last sign-in. */
function StatusGridCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  return (
    <DataTable.Cell
      tag={
        <FloatingTooltip content={row.statusTooltip} disabled={!row.statusTooltip} as="span">
          <Tag label={row.status?.label ?? ''} variant={row.status?.variant} loading={loading} />
        </FloatingTooltip>
      }
      secondary={loading ? undefined : `Last sign-in: ${row.lastSignIn ?? 'Never'}`}
    />
  );
}

/**
 * The grid's one line of `CustomerCell`: the first customer's logo and name, then how many more and the tenant the
 * account is in. Every customer with its claim on hover, as in a card row.
 */
function CustomerGridCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const customers = row.customers ?? [];
  if (loading) return <DataTable.Cell leading={{ type: 'image', alt: '' }} text="" />;
  const { first, more } = firstAndCount(customers.map(customer => customer.name));
  const tenant = row.tenant?.name ?? 'Added in OpenFrame';
  return (
    <FloatingTooltip
      disabled={customers.length === 0}
      triggerClassName="flex min-w-0 flex-1"
      content={customers.map(customer => (
        <p key={customer.name}>{customer.claim ? `${customer.name} — ${customer.claim}` : customer.name}</p>
      ))}
    >
      <DataTable.Cell
        leading={customers[0] ? { type: 'image', src: customers[0].imageUrl, alt: customers[0].name } : undefined}
        text={first}
        tone={customers.length === 0 ? 'secondary' : 'primary'}
        secondary={more > 0 ? `+${more} · ${tenant}` : tenant}
      />
    </FloatingTooltip>
  );
}

/**
 * The columns. Each data column states what the grid layout reads beside the card layout's `meta.width`: a `size`, a
 * `minSize` where the cell holds more than text, a one-line `gridCell` and a `label` for the settings menu. The open
 * column is the grid's action column kept by hand, so that the card rows keep it as it is.
 */
function buildColumns(options: Record<keyof Selections, DataTableFilterOption[]>): ColumnDef<UserRow>[] {
  return [
    {
      id: COLUMNS_LAYOUT.user.id,
      header: COLUMNS_LAYOUT.user.header,
      cell: ({ row }: { row: Row<UserRow> }) => <UserCell row={row.original} />,
      enableSorting: false,
      size: 360,
      minSize: GRID_MIN_WIDTH.media,
      meta: liveColumnMeta(COLUMNS_LAYOUT.user, {
        label: 'User',
        gridCell: ({ row }: { row: Row<UserRow> }) => <UserGridCell row={row.original} />,
      }),
    },
    {
      id: COLUMNS_LAYOUT.status.id,
      header: COLUMNS_LAYOUT.status.header,
      cell: ({ row }: { row: Row<UserRow> }) => <StatusCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 260,
      meta: liveColumnMeta(COLUMNS_LAYOUT.status, {
        label: 'Status',
        filter: { options: options.status },
        gridCell: ({ row }: { row: Row<UserRow> }) => <StatusGridCell row={row.original} />,
      }),
    },
    {
      id: COLUMNS_LAYOUT.customer.id,
      header: COLUMNS_LAYOUT.customer.header,
      cell: ({ row }: { row: Row<UserRow> }) => <CustomerCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 280,
      minSize: GRID_MIN_WIDTH.media,
      meta: liveColumnMeta(COLUMNS_LAYOUT.customer, {
        label: 'Customer',
        filter: { options: options.customer },
        gridCell: ({ row }: { row: Row<UserRow> }) => <CustomerGridCell row={row.original} />,
      }),
    },
    {
      id: COLUMNS_LAYOUT.group.id,
      header: COLUMNS_LAYOUT.group.header,
      cell: ({ row }: { row: Row<UserRow> }) => <FirstPlusCountCell names={row.original.groups} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 200,
      // One line already ("first +N"): the grid draws the same cell.
      meta: liveColumnMeta(COLUMNS_LAYOUT.group, { label: 'Group', filter: { options: options.group } }),
    },
    {
      id: COLUMNS_LAYOUT.open.id,
      cell: ({ row }: { row: Row<UserRow> }) => {
        const { href, name } = row.original;
        if (!href) return null;
        return <OpenRowButton label={`Open ${name ?? 'user'} in new tab`} onClick={openInNewTab(href)} />;
      },
      enableSorting: false,
      size: GRID_ACTION_COLUMN_SIZE,
      enableHiding: false,
      meta: liveColumnMeta(COLUMNS_LAYOUT.open, {
        gridKind: 'action',
        gridCell: ({ row }: { row: Row<UserRow> }) => {
          const { href, name } = row.original;
          return (
            <OpenRowButton
              grid
              label={`Open ${name ?? 'user'} in new tab`}
              disabled={!href}
              onClick={href ? openInNewTab(href) : () => {}}
            />
          );
        },
      }),
    },
  ];
}

const getRowId = (row: UserRow) => row.id;
const rowHref = (row: UserRow) => row.href ?? null;
const SKELETON_ROWS = 4;

/** The table, from the rows it is handed (`null` while they are read). */
function DirectoryUsersRows({
  users,
  tableLayout,
}: {
  users: readonly DirectoryUser[] | null;
  tableLayout: TableLayout;
}) {
  const loading = useLoadingScope();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [selections, setSelections] = useState<Selections>(NO_SELECTIONS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const rows = useMemo(() => (users ?? []).map(toRow), [users]);
  const searched = useMemo(() => rows.filter(row => matchesSearch(row, debouncedSearch)), [rows, debouncedSearch]);
  const visible = useMemo(() => searched.filter(row => matches(row, selections)), [searched, selections]);
  const options = {
    status: facetOptions(searched, selections, 'status'),
    customer: facetOptions(searched, selections, 'customer'),
    group: facetOptions(searched, selections, 'group'),
  };
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, setSelections);
  const placeholderRows = useMemo(() => (loading ? loadingPlaceholderRows<UserRow>(SKELETON_ROWS) : null), [loading]);
  const table = useDataTable<UserRow>({
    data: placeholderRows ?? visible,
    columns: buildColumns(options),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  if (!loading && rows.length === 0) {
    return (
      <TabEmptyState icon={<UsersIcon />} title="No users yet" description="This device’s users will appear here." />
    );
  }

  const filterGroups: FilterGroup[] = (
    [
      [COLUMNS_LAYOUT.status, options.status],
      [COLUMNS_LAYOUT.customer, options.customer],
      [COLUMNS_LAYOUT.group, options.group],
    ] as const
  ).map(([column, groupOptions]) => ({
    id: column.id,
    title: column.header,
    options: groupOptions,
  }));

  return (
    <div className="flex flex-col" style={containerStyle}>
      <UserTabHeading title="Users" />
      <div className="pt-[var(--spacing-system-l)]">
        <SearchToolbar
          toolbarRef={toolbarRef}
          placeholder="Search for Users"
          value={search}
          onChange={setSearch}
          disabled={loading}
          actions={
            <Button
              variant="outline"
              size="icon"
              className="content-md:hidden"
              onClick={() => setFiltersOpen(true)}
              disabled={loading}
              aria-label="Open filters"
              leftIcon={<Filter02Icon className="text-ods-text-primary" />}
            />
          }
        />
      </div>
      <LiveTable
        table={table}
        skeletonRows={SKELETON_ROWS}
        loadingCells={loading}
        stickyHeaderOffset={stickyHeaderOffset}
        itemName="result"
        totalCount={visible.length}
        emptyState={oneLineEmptyState(
          debouncedSearch
            ? `No users found matching "${debouncedSearch}". Try adjusting your search.`
            : 'No users match the selected filters. Try adjusting your filters.',
        )}
        rowHref={rowHref}
        // The grid table keeps the tab's natural height (the page scrolls); the card rows take neither option.
        layout={tableLayout}
        settings={DIRECTORY_USERS_TABLE_SETTINGS}
      />
      <FilterModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filterGroups={filterGroups}
        currentFilters={{ ...selections }}
        onFilterChange={filters =>
          setSelections({
            status: filters.status ?? [],
            customer: filters.customer ?? [],
            group: filters.group ?? [],
          })
        }
      />
    </div>
  );
}

function DirectoryUsersQuery({ machineId, tableLayout }: { machineId: string; tableLayout: TableLayout }) {
  const retryKey = useRetryKey();
  const { deviceDirectory } = useLazyLoadQuery<DirectoryUsersTabQueryType>(
    directoryUsersTabQuery,
    { machineId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return <DirectoryUsersRows users={deviceDirectory.users} tableLayout={tableLayout} />;
}

function DirectoryUsersReader({ machineId, tableLayout }: { machineId: string | null; tableLayout: TableLayout }) {
  if (useLoadingScope() || !machineId) return <DirectoryUsersRows users={null} tableLayout={tableLayout} />;
  return <DirectoryUsersQuery machineId={machineId} tableLayout={tableLayout} />;
}

/**
 * Device page → Users on a tenant with directories (Figma 1374:241): directory users only (D30).
 *
 * `tableLayout="grid"` draws the lib's grid table (48px one-line rows, the user column pinned, the open action pinned
 * right, the gear menu), at the tab's natural height. Default `cards`.
 */
export function DirectoryUsersTab({
  device,
  tableLayout = 'cards',
}: {
  device: Device | null;
  tableLayout?: TableLayout;
}) {
  const machineId = device?.machineId ?? null;
  return (
    <LoadingSuspense live label="Loading users" gated={!machineId}>
      <DirectoryUsersReader machineId={machineId} tableLayout={tableLayout} />
    </LoadingSuspense>
  );
}
