'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  LoadingWhen,
  PageError,
  SearchInput,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { LiveTable } from '@/app/components/shared/live-table';
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

  const table = useDataTable<Dialog>({
    data: tickets,
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
      <LoadingWhen loading={isLoading}>
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
        />
      </LoadingWhen>
    </div>
  );
}
