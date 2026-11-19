'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  LoadingWhen,
  PageError,
  SearchInput,
  useDataTable,
  useLoadingScope,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type Row,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { oneLineEmptyState } from '@/app/components/shared/empty-state';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import {
  getTicketOpenColumn,
  getTicketTableColumns,
  ticketRowHref,
} from '../../../tickets/components/ticket-table-columns';
import { TICKETS_PAGE_SIZE, useTicketsQuery } from '../../../tickets/hooks/use-tickets-query';
import type { Dialog } from '../../../tickets/types/dialog.types';
import { CustomerTabHeader } from './customer-tab-header';

/**
 * The grid widths of this tab's ticket columns, by column: the grid lays a column out by its `size`, the card rows by
 * the shared columns' own widths. The cells' one-line grid form belongs to the shared ticket columns: until they state
 * one, the grid clips their card cells to one line.
 */
const GRID_COLUMN_SIZE: Record<string, { size: number; minSize?: number; label: string }> = {
  title: { size: 420, label: 'Ticket' },
  source: { size: 280, minSize: GRID_MIN_WIDTH.icon, label: 'Source' },
  assignee: { size: 280, minSize: GRID_MIN_WIDTH.media, label: 'Assignee' },
  status: { size: 180, label: 'Status' },
};

interface CustomerTicketsTabProps {
  organizationId: string;
}

export function CustomerTicketsTab({ organizationId }: CustomerTicketsTabProps) {
  const router = useRouter();
  // While the customer loads the tab is drawn in the page's loading scope (no id, nothing fetched).
  const scoped = useLoadingScope();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  // The layout the customer's page asks for.
  const tableGrid = useTableGrid('customer-tickets');

  // Scoped on the server (`TicketFilterInput.organizationIds`): a ticket counts as the customer's
  // only through its own `organizationId`, not through the owning machine's current organization.
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
    organizationIds: [organizationId],
    // While the customer loads the tab draws itself in a loading scope with no id: nothing is fetched then.
    enabled: !!organizationId,
  });

  const { isUserDeleted } = useUserStatusMap(tickets.map(ticket => ticket.assignedTo));
  // The shared ticket columns and the trailing open-in-new-tab action.
  const columns = useMemo<ColumnDef<Dialog>[]>(() => {
    const data = getTicketTableColumns({ isArchived: false, isUserDeleted }).map(source => {
      // What the grid reads beside the card widths: the column's size and its name in the settings menu.
      const key = (source as { accessorKey?: string }).accessorKey;
      const grid = key ? GRID_COLUMN_SIZE[key] : undefined;
      return grid
        ? { ...source, size: grid.size, minSize: grid.minSize, meta: { ...source.meta, label: grid.label } }
        : source;
    });
    // The open column is the grid's action column kept by hand (pinned right, never hidden), so that the card rows
    // keep it as it is. In the grid it draws the shared open button's grid form (no border or fill of its own), as
    // every other list's action column does; the card cell stays the shared ticket column's.
    const open = getTicketOpenColumn();
    return [
      ...data,
      {
        ...open,
        size: GRID_ACTION_COLUMN_SIZE,
        enableHiding: false,
        meta: {
          ...open.meta,
          gridKind: 'action',
          gridCell: ({ row }: { row: Row<Dialog> }) => (
            <OpenRowButton grid label="Open in new tab" onClick={openInNewTab(ticketRowHref(row.original))} />
          ),
        },
      },
    ];
  }, [isUserDeleted]);

  const loading = scoped || isLoading;
  // While the customer or the first page is read the table holds one page of placeholder rows, drawn with the real
  // cells (each cell draws its own loading form).
  const loadingRows = useMemo(() => (loading ? loadingPlaceholderRows<Dialog>(TICKETS_PAGE_SIZE) : null), [loading]);

  const table = useDataTable<Dialog>({
    data: loadingRows ?? tickets,
    columns,
    getRowId: (row: Dialog) => String(row.id),
    enableSorting: false,
  });

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage]);

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      <CustomerTabHeader
        title="Tickets"
        rightActions={
          <ResponsiveActionButton
            label="New Ticket"
            icon={<PlusCircleIcon className="h-5 w-5 text-ods-text-secondary" />}
            onClick={() => router.push(routes.tickets.new())}
          />
        }
      />

      {/* Sticky search row — vertical `py/-my` of `spacing-l` extends bg above
          and below without adding layout space. When pinned, the bar has
          breathing room on top, and the DataTable header (sticky at top-[96px]
          = 24 + 48 + 24) docks flush below. */}
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search for Tickets" />
      </div>

      {/* The first page is a client read: the table draws its own loading state in this scope. */}
      <LoadingWhen loading={loading}>
        <LiveTable
          {...tableGrid}
          table={table}
          pageSize={TICKETS_PAGE_SIZE}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
          itemName="ticket"
          totalCount={filteredCount}
          emptyState={oneLineEmptyState('No tickets found for this customer.')}
          rowHref={ticketRowHref}
          footer={{ hasNextPage, isFetchingNextPage, onLoadMore: handleLoadMore }}
          loadingCells={loading}
        />
      </LoadingWhen>
    </div>
  );
}
