'use client';

import { TagIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  LoadingWhen,
  PageError,
  SearchInput,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo, useState } from 'react';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import {
  getTicketOpenColumn,
  getTicketTableColumns,
  ticketRowHref,
} from '../../../tickets/components/ticket-table-columns';
import { DEVICE_TICKET_COLUMNS } from '../../../tickets/components/ticket-table-layout';
import { TICKETS_PAGE_SIZE, useTicketsQuery } from '../../../tickets/hooks/use-tickets-query';
import type { Dialog } from '../../../tickets/types/dialog.types';
import type { Device } from '../../types/device.types';
import { TabEmptyState } from './tab-empty-state';

interface TicketsTabProps {
  device: Device | null;
}

export function TicketsTab({ device }: TicketsTabProps) {
  // The device has not answered (the page's loading scope), or the first page has not.
  const scoped = useLoadingScope();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Scoped on the server by machine id (`TicketFilterInput.deviceIds`, the id the detail route
  // carries and the one `Ticket.deviceId` stores). A ticket whose device was unlinked is not the
  // device's any more, so the old owner-machine fallback is gone with the client-side matcher.
  const machineId = device?.machineId;
  const {
    dialogs: tickets,
    filteredCount,
    isLoading,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useTicketsQuery({
    archived: false,
    search: debouncedSearch,
    deviceIds: machineId ? [machineId] : [],
    enabled: Boolean(machineId),
  });

  // Reuse the shared ticket columns, but drop the device/source column — it's redundant on a
  // device-scoped list — and keep the trailing open-in-new-tab action.
  // With SOURCE dropped the shared flex widths drift, so ASSIGNEE/STATUS are pinned to fixed
  // widths. Those widths live in `DEVICE_TICKET_COLUMNS`, the one declaration of this table's
  // layout.
  const { isUserDeleted } = useUserStatusMap(tickets.map(ticket => ticket.assignedTo));

  const columns = useMemo<ColumnDef<Dialog>[]>(() => {
    const widthById = new Map(DEVICE_TICKET_COLUMNS.map(column => [column.id, column.width]));
    const base = getTicketTableColumns({ isArchived: false, isUserDeleted })
      .filter(column => (column as { accessorKey?: string }).accessorKey !== 'source')
      .map(column => {
        const key = (column as { accessorKey?: string }).accessorKey;
        const width = key ? widthById.get(key) : undefined;
        if (key === 'status' && column.meta?.filter) {
          // STATUS is the last data column here: anchor its filter dropdown to
          // the header's right edge so it doesn't overflow past the table.
          return {
            ...column,
            meta: {
              ...column.meta,
              ...(width && { width }),
              filter: { ...column.meta.filter, placement: 'bottom-end' as const },
            },
          };
        }
        return width ? { ...column, meta: { ...column.meta, width } } : column;
      });
    return [...base, getTicketOpenColumn()];
  }, [isUserDeleted]);

  const loading = scoped || isLoading;
  // While the device or the first page is read the table holds one page of placeholder rows, drawn with the real
  // cells (each cell draws its own loading form).
  const loadingRows = useMemo(() => (loading ? loadingPlaceholderRows<Dialog>(TICKETS_PAGE_SIZE) : null), [loading]);

  const table = useDataTable<Dialog>({
    data: loadingRows ?? tickets,
    columns,
    getRowId: (row: Dialog) => String(row.id),
    enableSorting: false,
  });

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage]);

  if (!loading && error) {
    return <PageError message={error} />;
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active or still loading).
  const hasSearch = debouncedSearch.trim().length > 0;
  const isEmpty = tickets.length === 0;
  const showChrome = loading || !isEmpty || hasSearch;

  // Genuinely no tickets (no data before any search manipulation) → the plain
  // design empty state: icon + title + description only — the rich
  // onboarding version stays on the Tickets page. A search with zero matches
  // keeps the table chrome and its compact empty state below. Only once the
  // server has nothing further to page in — an empty first page with a next
  // page is still "loading", not "empty".
  if (!loading && isEmpty && !hasNextPage && !hasSearch) {
    return (
      <TabEmptyState
        icon={<TagIcon />}
        title="Ticket history empty"
        description="Conversations will appear here when available"
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {showChrome && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search for Tickets" />
        </div>
      )}

      {/* The first page is a client read: the table draws its own loading state in this scope. */}
      <LoadingWhen loading={loading}>
        <LiveTable
          table={table}
          pageSize={TICKETS_PAGE_SIZE}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
          showHeader={loading || !isEmpty}
          itemName="ticket"
          totalCount={filteredCount}
          emptyState={{
            icon: <TagIcon />,
            title: 'No tickets found',
            description: debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : 'Tickets linked to this device will appear here.',
          }}
          rowHref={ticketRowHref}
          footer={{ hasNextPage, isFetchingNextPage, onLoadMore: handleLoadMore }}
          loadingCells={loading}
        />
      </LoadingWhen>
    </div>
  );
}
