'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type Row,
  SearchInput,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import type { Device } from '../../types/device.types';
import { USER_COLUMNS } from './device-tab-columns';
import { TabEmptyState } from './tab-empty-state';

interface UsersTabProps {
  device: Device | null;
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

export function UsersTab({ device }: UsersTabProps) {
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
        cell: ({ row }: { row: Row<UserRow> }) => (
          <div className="flex flex-col justify-center min-w-0">
            <TruncateText>{row.original.username}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {roleLabel(row.original)}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(USER_COLUMNS.username),
      },
      {
        accessorKey: 'uid',
        header: USER_COLUMNS.uid.header,
        cell: ({ row }: { row: Row<UserRow> }) => (
          <span className="text-h4 text-ods-text-primary">
            {row.original.uid !== undefined ? row.original.uid : '—'}
          </span>
        ),
        enableSorting: false,
        meta: liveColumnMeta(USER_COLUMNS.uid),
      },
      {
        accessorKey: 'type',
        header: USER_COLUMNS.type.header,
        cell: ({ row }: { row: Row<UserRow> }) => (
          <span className="text-h4 text-ods-text-primary capitalize">{row.original.type || '—'}</span>
        ),
        enableSorting: false,
        meta: liveColumnMeta(USER_COLUMNS.type),
      },
      {
        accessorKey: 'groupname',
        header: USER_COLUMNS.groupname.header,
        cell: ({ row }: { row: Row<UserRow> }) => (
          <TruncateText tone={row.original.groupname ? 'primary' : 'secondary'}>
            {row.original.groupname || '—'}
          </TruncateText>
        ),
        enableSorting: false,
        meta: liveColumnMeta(USER_COLUMNS.groupname),
      },
      {
        accessorKey: 'shell',
        header: USER_COLUMNS.shell.header,
        cell: ({ row }: { row: Row<UserRow> }) => (
          <TruncateText tone={row.original.shell ? 'primary' : 'secondary'}>{row.original.shell || '—'}</TruncateText>
        ),
        enableSorting: false,
        meta: liveColumnMeta(USER_COLUMNS.shell),
      },
      {
        id: USER_COLUMNS.status.id,
        header: USER_COLUMNS.status.header,
        cell: ({ row }: { row: Row<UserRow> }) =>
          row.original.isLoggedIn ? (
            <Tag label="ACTIVE" variant="success" className="w-fit" />
          ) : (
            <span className="text-h4 text-ods-text-secondary">—</span>
          ),
        enableSorting: false,
        meta: liveColumnMeta(USER_COLUMNS.status),
      },
    ],
    [],
  );

  const table = useDataTable<UserRow>({
    data: filteredRows,
    columns,
    getRowId: (row: UserRow) => row.id,
    enableSorting: false,
  });

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
    return (
      <TabEmptyState
        icon={<UsersIcon />}
        title="No users found"
        description="User accounts on this device will appear here."
      />
    );
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active, so the user can still clear it).
  const hasSearch = debouncedSearch.trim().length > 0;
  const isEmpty = filteredRows.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {device.endUserEmails && device.endUserEmails.length > 0 && (
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <span className="text-h6 text-ods-text-secondary uppercase">End-user emails</span>
          {device.endUserEmails.map(email => (
            <Tag key={email} label={email} variant="grey" className="w-fit" />
          ))}
        </div>
      )}

      {(!isEmpty || hasSearch) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 bg-ods-bg py-[var(--spacing-system-l)] -my-[var(--spacing-system-l)]"
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search for User" />
        </div>
      )}

      <DataTable table={table}>
        {!isEmpty && <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} />}
        <DataTable.Body
          rowClassName="mb-1"
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
