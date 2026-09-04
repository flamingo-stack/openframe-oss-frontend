'use client';

import { TagIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  PageError,
  SearchInput,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo, useState } from 'react';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import {
  getTicketOpenColumn,
  getTicketTableColumns,
  ticketRowHref,
} from '../../../tickets/components/ticket-table-columns';
import { DEVICE_TICKET_COLUMNS } from '../../../tickets/components/ticket-table-layout';
import { useTicketsQuery } from '../../../tickets/hooks/use-tickets-query';
import type { ClientDialogOwner, Dialog } from '../../../tickets/types/dialog.types';
import type { Device } from '../../types/device.types';
import { TabEmptyState } from './tab-empty-state';

interface TicketsTabProps {
  device: Device | null;
}

// TEMPORARY: the tickets API has no device filter (TicketFilterInput only
// supports statuses/organizations/assignees/tags), so we fetch the largest
// page the backend allows (100) and match tickets to this device client-side.
// Replace with a server-side `filter: { machineIds }` once the backend
// supports it.
const DEVICE_TICKETS_PAGE_SIZE = 100;

/** Match a ticket to this device strictly by machine id — never by hostname
 *  (hostnames are not unique or stable across Fleet/GraphQL sources). */
function ticketBelongsToDevice(ticket: Dialog, deviceIds: string[]): boolean {
  if (deviceIds.length === 0) return false;
  if (ticket.deviceId && deviceIds.includes(ticket.deviceId)) return true;

  const owner = ticket.owner;
  if (owner && 'machine' in owner) {
    const machine = (owner as ClientDialogOwner).machine;
    if (machine?.machineId && deviceIds.includes(machine.machineId)) return true;
    if (machine?.id && deviceIds.includes(machine.id)) return true;
  }
  if (owner && 'machineId' in owner && (owner as ClientDialogOwner).machineId) {
    if (deviceIds.includes((owner as ClientDialogOwner).machineId)) return true;
  }

  return false;
}

export function TicketsTab({ device }: TicketsTabProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const {
    dialogs: tickets,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useTicketsQuery({
    archived: false,
    search: debouncedSearch,
    pageSize: DEVICE_TICKETS_PAGE_SIZE,
  });

  // The device is identified by its machineId (the detail route param) — keep `id` too as a fallback.
  const deviceIds = useMemo(
    () => [device?.machineId, device?.id].filter((value): value is string => Boolean(value)),
    [device?.machineId, device?.id],
  );

  const deviceTickets = useMemo(() => tickets.filter(t => ticketBelongsToDevice(t, deviceIds)), [tickets, deviceIds]);

  // Reuse the shared ticket columns, but drop the device/source column — it's redundant on a
  // device-scoped list — and keep the trailing open-in-new-tab action.
  // With SOURCE dropped the shared flex widths drift, so ASSIGNEE/STATUS are pinned to fixed
  // widths. Those widths live in `DEVICE_TICKET_COLUMNS`, which `DeviceDetailsSkeleton` reads
  // too — the page-level skeleton, the tab's own loading skeleton and the loaded table then
  // share one declaration (no header jump between loading phases).
  const { isUserDeleted } = useUserStatusMap();

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

  const table = useDataTable<Dialog>({
    data: deviceTickets,
    columns,
    getRowId: (row: Dialog) => String(row.id),
    enableSorting: false,
  });

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage]);

  if (error) {
    return <PageError message={error} />;
  }

  // Empty table → show only the centered empty state: hide the column header always, and
  // hide the search too (unless a search is active or still loading).
  const hasSearch = debouncedSearch.trim().length > 0;
  const isEmpty = deviceTickets.length === 0;
  const showChrome = isLoading || !isEmpty || hasSearch;

  // Genuinely no tickets (no data before any search manipulation) → the plain
  // design empty state (447-30474): icon + title + description only — the rich
  // onboarding version stays on the Tickets page. A search with zero matches
  // keeps the table chrome and its compact empty state below.
  if (!isLoading && isEmpty && !hasSearch) {
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

      <DataTable table={table}>
        {(isLoading || !isEmpty) && (
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={<DataTable.RowCount itemName="ticket" totalCount={deviceTickets.length} />}
          />
        )}
        <DataTable.Body
          loading={isLoading}
          skeletonRows={8}
          emptyState={{
            icon: <TagIcon />,
            title: 'No tickets found',
            description: debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : 'Tickets linked to this device will appear here.',
          }}
          rowHref={ticketRowHref}
          rowClassName="mb-1"
        />
        <DataTable.InfiniteFooter
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={handleLoadMore}
          skeletonRows={2}
        />
      </DataTable>
    </div>
  );
}
