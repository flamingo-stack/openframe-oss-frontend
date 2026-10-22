'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  LoadingWhen,
  PageError,
  SearchInput,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { routes } from '@/lib/routes';
import {
  getTicketOpenColumn,
  getTicketTableColumns,
  ticketRowHref,
} from '../../../tickets/components/ticket-table-columns';
import { TICKETS_PAGE_SIZE, useTicketsQuery } from '../../../tickets/hooks/use-tickets-query';
import type { Dialog } from '../../../tickets/types/dialog.types';
import { CustomerTabHeader } from './customer-tab-header';

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

  const { isUserDeleted } = useUserStatusMap();
  // The shared ticket columns and the trailing open-in-new-tab action.
  const columns = useMemo<ColumnDef<Dialog>[]>(
    () => [...getTicketTableColumns({ isArchived: false, isUserDeleted }), getTicketOpenColumn()],
    [isUserDeleted],
  );

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
          table={table}
          pageSize={TICKETS_PAGE_SIZE}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
          itemName="ticket"
          totalCount={filteredCount}
          emptyState={{ title: 'No tickets found for this customer.' }}
          rowHref={ticketRowHref}
          footer={{ hasNextPage, isFetchingNextPage, onLoadMore: handleLoadMore }}
          loadingCells={loading}
        />
      </LoadingWhen>
    </div>
  );
}
