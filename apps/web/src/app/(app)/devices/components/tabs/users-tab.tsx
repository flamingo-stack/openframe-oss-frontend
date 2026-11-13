'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type DataTableSettings,
  type Row,
  SearchInput,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { LIVE_ROW_GAP_CLASS, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { ValueGridCell } from '@/app/components/shared/value-grid-cell';
import { ValueText } from '@/app/components/shared/value-text';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import type { Device } from '../../types/device.types';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

/** The Users table's columns. */
const USER_COLUMNS = {
  username: { id: 'username', header: 'USER', width: 'flex-1 min-w-0' },
  uid: { id: 'uid', header: 'UID', width: 'w-[100px] shrink-0' },
  type: { id: 'type', header: 'TYPE', width: 'w-[120px] shrink-0', hideAt: 'md' },
  groupname: { id: 'groupname', header: 'GROUP', width: 'w-[160px] shrink-0', hideAt: 'lg' },
  shell: { id: 'shell', header: 'SHELL', width: 'w-[200px] shrink-0', hideAt: 'lg' },
  status: { id: 'status', header: 'STATUS', width: 'w-[120px] shrink-0', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order, resized
 * widths) kept in the browser under this table's own key.
 */
const USERS_TABLE_SETTINGS: DataTableSettings = { storageKey: 'device-users' };

interface UsersTabProps {
  device: Device | null;
  /**
   * The table's layout. `grid` draws the lib's grid table (48px one-line rows, the user column pinned, the gear menu),
   * at the tab's natural height: the page scrolls. Default `cards`.
   */
  tableLayout?: TableLayout;
}

interface UserRow {
  id: string;
  username: string;
  uid?: number;
  type?: string;
  groupname?: string;
  shell?: string;
  isLoggedIn?: boolean;
}

function roleLabel(user: UserRow): string {
  if (user.isLoggedIn) return 'Active session';
  if (user.type === 'person') return 'User account';
  if (user.type) return `${user.type} account`;
  return 'System user';
}

/**
 * Rows the loading table holds (placeholder rows, drawn with their real cells): the list is read whole, so this is the
 * body's own default count (the lib's `DATA_TABLE_SKELETON_ROWS`), stated here so the rows and the body agree.
 */
const USERS_TAB_SKELETON_ROWS = 10;

/** The account name over its role; on a loading row both lines are bars (a placeholder has no role). */
function UserNameCell({ user }: { user: UserRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText loading={loading}>{user.username}</TruncateText>
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {roleLabel(user)}
      </TruncateText>
    </div>
  );
}

/** The grid's one line: the account name with its role after it. */
function UserNameGridCell({ user }: { user: UserRow }) {
  // A row still being read has no name: the cell draws its bar, and no role beside it.
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  return <DataTable.Cell text={user.username} secondary={roleLabel(user)} />;
}

/** The account type; a bar of its line on a loading row. */
function UserTypeCell({ type }: { type: string | undefined }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h4" className="w-3/4" />;
  return <span className="capitalize text-ods-text-primary text-h4">{type || <EmptyValue />}</span>;
}

/** The account type as the card row prints it (CSS capitalises it there): "person" reads "Person". */
function typeLabel(type: string | undefined): string | undefined {
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : undefined;
}

export function UsersTab({ device, tableLayout = 'cards' }: UsersTabProps) {
  const loading = useLoadingScope();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const rows = useMemo<UserRow[]>(
    () =>
      (device?.users || []).map((user, index) => ({
        id: `${user.username}-${user.uid ?? index}`,
        username: user.username,
        uid: user.uid,
        type: user.type,
        groupname: user.groupname,
        shell: user.shell,
        isLoggedIn: user.isLoggedIn,
      })),
    [device?.users],
  );

  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      user =>
        user.username.toLowerCase().includes(query) ||
        (user.groupname ?? '').toLowerCase().includes(query) ||
        (user.type ?? '').toLowerCase().includes(query),
    );
  }, [rows, debouncedSearch]);

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'username',
        header: USER_COLUMNS.username.header,
        cell: ({ row }: { row: Row<UserRow> }) => <UserNameCell user={row.original} />,
        enableSorting: false,
        size: 280,
        meta: liveColumnMeta(USER_COLUMNS.username, {
          label: 'User',
          gridCell: ({ row }: { row: Row<UserRow> }) => <UserNameGridCell user={row.original} />,
        }),
      },
      {
        accessorKey: 'uid',
        header: USER_COLUMNS.uid.header,
        cell: ({ row }: { row: Row<UserRow> }) => <ValueText value={row.original.uid} />,
        enableSorting: false,
        size: 120,
        meta: liveColumnMeta(USER_COLUMNS.uid, {
          label: 'UID',
          gridCell: ({ row }: { row: Row<UserRow> }) => <ValueGridCell value={row.original.uid} />,
        }),
      },
      {
        accessorKey: 'type',
        header: USER_COLUMNS.type.header,
        cell: ({ row }: { row: Row<UserRow> }) => <UserTypeCell type={row.original.type} />,
        enableSorting: false,
        size: 140,
        meta: liveColumnMeta(USER_COLUMNS.type, {
          label: 'Type',
          gridCell: ({ row }: { row: Row<UserRow> }) => <ValueGridCell value={typeLabel(row.original.type)} />,
        }),
      },
      {
        accessorKey: 'groupname',
        header: USER_COLUMNS.groupname.header,
        cell: ({ row }: { row: Row<UserRow> }) => <ValueText value={row.original.groupname} />,
        enableSorting: false,
        size: 180,
        meta: liveColumnMeta(USER_COLUMNS.groupname, {
          label: 'Group',
          gridCell: ({ row }: { row: Row<UserRow> }) => <ValueGridCell value={row.original.groupname} />,
        }),
      },
      {
        accessorKey: 'shell',
        header: USER_COLUMNS.shell.header,
        cell: ({ row }: { row: Row<UserRow> }) => <ValueText value={row.original.shell} />,
        enableSorting: false,
        size: 240,
        meta: liveColumnMeta(USER_COLUMNS.shell, {
          label: 'Shell',
          gridCell: ({ row }: { row: Row<UserRow> }) => <ValueGridCell value={row.original.shell} />,
        }),
      },
      {
        id: USER_COLUMNS.status.id,
        header: USER_COLUMNS.status.header,
        cell: ({ row }: { row: Row<UserRow> }) =>
          row.original.isLoggedIn ? (
            <Tag label="ACTIVE" variant="success" className="w-fit" />
          ) : (
            <ValueText value={null} />
          ),
        enableSorting: false,
        size: 140,
        meta: liveColumnMeta(USER_COLUMNS.status, {
          label: 'Status',
          gridCell: ({ row }: { row: Row<UserRow> }) =>
            row.original.isLoggedIn ? (
              <DataTable.Cell tag={<Tag label="ACTIVE" variant="success" />} />
            ) : (
              <ValueGridCell value={null} />
            ),
        }),
      },
    ],
    [],
  );

  // In the tab's loading scope the table holds placeholder rows, drawn with their real cells (`loadingCells`): each
  // cell draws its own loading form (a placeholder is not logged in, so its status is the empty value's bar).
  const data = useMemo(
    () => (loading ? loadingPlaceholderRows<UserRow>(USERS_TAB_SKELETON_ROWS) : filteredRows),
    [loading, filteredRows],
  );
  const table = useDataTable<UserRow>({
    data,
    columns,
    getRowId: (row: UserRow) => row.id,
    enableSorting: false,
  });

  // The device has not answered: the tab draws itself in the loading scope, every part its own skeleton.
  if (!loading) {
    if (!device) {
      return (
        <TabEmptyState
          icon={<UsersIcon />}
          title="No users found"
          description="User accounts on this device will appear here."
        />
      );
    }

    if (rows.length === 0) {
      if (device.sources?.fleet === 'skipped-pending') {
        return <TabDeployingEmptyState icon={<UsersIcon />} section="Users" />;
      }
      return (
        <TabEmptyState
          icon={<UsersIcon />}
          title="No users found"
          description="User accounts on this device will appear here."
        />
      );
    }
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active, so the user can still clear it).
  const hasSearch = debouncedSearch.trim().length > 0;
  const isEmpty = !loading && filteredRows.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {/* Only some devices report end-user emails: a strip over the users table, not drawn while the device is read. */}
      {device?.endUserEmails && device.endUserEmails.length > 0 && (
        <div data-loading-optional className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <span className="uppercase text-ods-text-secondary text-h6">End-user emails</span>
          {device.endUserEmails.map(email => (
            <Tag key={email} label={email} variant="grey" className="w-fit" data-loading-item />
          ))}
        </div>
      )}

      {(!isEmpty || hasSearch) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search for User" />
        </div>
      )}

      {/* The settings belong to the grid; the table keeps its natural height in both layouts (the page scrolls). */}
      <DataTable
        table={table}
        layout={tableLayout}
        settings={tableLayout === 'grid' ? USERS_TABLE_SETTINGS : undefined}
      >
        {!isEmpty && <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} loading={loading} />}
        <DataTable.Body
          loadingCells={loading}
          skeletonRows={USERS_TAB_SKELETON_ROWS}
          rowClassName={LIVE_ROW_GAP_CLASS}
          emptyState={{
            icon: <UsersIcon />,
            title: 'No users found',
            description: debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : 'User accounts on this device will appear here.',
          }}
        />
      </DataTable>
    </div>
  );
}
