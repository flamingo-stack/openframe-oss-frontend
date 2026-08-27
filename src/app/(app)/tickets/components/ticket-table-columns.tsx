import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  DeviceCardCompact,
  type OnChangeFn,
  type Row,
  resolveStatusTagProps,
  SquareAvatar,
  TicketStatusTag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useMemo } from 'react';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { formatDateTime } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { ClientDialogOwner, Dialog } from '../types/dialog.types';
import { TICKET_COLUMNS } from './ticket-table-layout';

export interface StatusFilterOption {
  id: string;
  value: string;
  label: string;
}

// Legacy status filter options (ticket-statuses feature flag OFF).
const LEGACY_STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { id: 'ACTIVE', value: 'ACTIVE', label: 'Active' },
  { id: 'TECH_REQUIRED', value: 'TECH_REQUIRED', label: 'Tech Required' },
  { id: 'ON_HOLD', value: 'ON_HOLD', label: 'On Hold' },
  { id: 'RESOLVED', value: 'RESOLVED', label: 'Resolved' },
];

interface TicketTableColumnsOptions {
  isArchived?: boolean;
  // Lifecycle status options (value = status id). Falls back to the legacy enum options when omitted.
  statusOptions?: StatusFilterOption[];
  /**
   * Deleted-user probe from `useUserStatusMap` — the ticket payload only
   * carries a denormalized assignee snapshot (id + name), no status. When it
   * answers true for `assignedTo`, the assignee cell renders the deleted
   * treatment (red user-x avatar + red name).
   */
  isUserDeleted?: (id?: string | null) => boolean;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return formatDateTime(date);
}

export function getTicketTableColumns(options: TicketTableColumnsOptions = {}): ColumnDef<Dialog>[] {
  const { isArchived = false, statusOptions, isUserDeleted } = options;

  const titleColumn: ColumnDef<Dialog> = {
    accessorKey: 'title',
    header: TICKET_COLUMNS.title.header,
    cell: ({ row }: { row: Row<Dialog> }) => {
      const ticket = row.original;
      return (
        <div className="flex flex-col justify-center min-w-0">
          <TruncateText>{ticket.title || 'Untitled Ticket'}</TruncateText>
          <TruncateText variant="h6" tone="secondary">
            {formatTimestamp(ticket.createdAt)}
          </TruncateText>
        </div>
      );
    },
    meta: liveColumnMeta(TICKET_COLUMNS.title),
  };

  const sourceColumn: ColumnDef<Dialog> = {
    accessorKey: 'source',
    header: TICKET_COLUMNS.source.header,
    cell: ({ row }: { row: Row<Dialog> }) => {
      const ticket = row.original;
      const isClientOwner = 'machine' in (ticket.owner || {});
      const clientOwner = isClientOwner ? (ticket.owner as ClientDialogOwner) : null;
      const deviceName = ticket.deviceHostname || clientOwner?.machine?.hostname || clientOwner?.machine?.displayName;

      return <DeviceCardCompact deviceName={deviceName || '—'} organization={ticket.organizationName} />;
    },
    enableSorting: false,
    meta: liveColumnMeta(TICKET_COLUMNS.source),
  };

  const middleColumn: ColumnDef<Dialog> = {
    accessorKey: 'assignee',
    header: TICKET_COLUMNS.assignee.header,
    cell: ({ row }: { row: Row<Dialog> }) => {
      const ticket = row.original;
      const isDeletedAssignee = isUserDeleted?.(ticket.assignedTo) ?? false;
      return ticket.assignedName ? (
        <div className="flex items-center gap-2 min-w-0">
          {isDeletedAssignee ? (
            <DeletedUserAvatar size="sm" />
          ) : (
            <SquareAvatar
              src={getFullImageUrl(ticket.assigneeImageUrl, ticket.assigneeImageHash)}
              alt={ticket.assignedName}
              fallback={ticket.assignedName}
              size="sm"
              variant="round"
              className="shrink-0"
            />
          )}
          <TruncateText className={isDeletedAssignee ? 'text-ods-error' : undefined}>
            {ticket.assignedName}
          </TruncateText>
        </div>
      ) : (
        <span className="text-h4 text-ods-text-secondary">{'—'}</span>
      );
    },
    enableSorting: false,
    meta: liveColumnMeta(TICKET_COLUMNS.assignee),
  };

  const statusColumn: ColumnDef<Dialog> = {
    accessorKey: 'status',
    header: TICKET_COLUMNS.status.header,
    cell: ({ row }: { row: Row<Dialog> }) => <TicketStatusTag {...resolveStatusTagProps(row.original)} />,
    meta: liveColumnMeta(TICKET_COLUMNS.status),
    ...(!isArchived && {
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(TICKET_COLUMNS.status, {
        filter: { options: statusOptions ?? LEGACY_STATUS_FILTER_OPTIONS },
      }),
    }),
  };

  return [titleColumn, sourceColumn, middleColumn, statusColumn];
}

export const ticketRowHref = (ticket: Dialog): string => routes.tickets.dialog(ticket.id);

export function getTicketOpenColumn(getUnreadCount?: (ticket: Dialog) => number | undefined): ColumnDef<Dialog> {
  return {
    id: TICKET_COLUMNS.open.id,
    cell: ({ row }: { row: Row<Dialog> }) => {
      // This trailing slot shows the unread-message count when there is one, otherwise the open action.
      const unread = getUnreadCount?.(row.original);
      if (unread) {
        return (
          <span
            className="inline-flex h-12 min-w-12 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)] text-h3 font-bold text-ods-text-on-accent"
            aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        );
      }
      return (
        <div data-no-row-click className="flex items-center justify-end pointer-events-auto">
          <Button
            onClick={openInNewTab(ticketRowHref(row.original))}
            variant="outline"
            size="icon"
            leftIcon={<ArrowRightUpIcon className="w-5 h-5" />}
            aria-label="Open in new tab"
            className="bg-ods-card"
          />
        </div>
      );
    },
    enableSorting: false,
    meta: liveColumnMeta(TICKET_COLUMNS.open),
  };
}

interface TicketTableBodyProps {
  tickets: Dialog[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  stickyHeaderOffset?: string;
  footerSlot?: ReactNode;
  isArchived?: boolean;
  actionsColumn?: ColumnDef<Dialog>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  statusOptions?: StatusFilterOption[];
  getUnreadCount?: (ticket: Dialog) => number | undefined;
}

export function TicketTableBody({
  tickets,
  isLoading,
  emptyMessage = 'No tickets found.',
  skeletonRows,
  stickyHeaderOffset,
  footerSlot,
  isArchived,
  actionsColumn,
  columnFilters,
  onColumnFiltersChange,
  statusOptions,
  getUnreadCount,
}: TicketTableBodyProps) {
  const { isUserDeleted } = useUserStatusMap();

  const columns = useMemo<ColumnDef<Dialog>[]>(() => {
    const base = getTicketTableColumns({ isArchived, statusOptions, isUserDeleted });
    const openColumn = getTicketOpenColumn(getUnreadCount);
    return actionsColumn ? [...base, actionsColumn, openColumn] : [...base, openColumn];
  }, [isArchived, actionsColumn, statusOptions, getUnreadCount, isUserDeleted]);

  const table = useDataTable<Dialog>({
    data: tickets,
    columns,
    getRowId: row => String(row.id),
    enableSorting: false,
    state: columnFilters !== undefined ? { columnFilters } : undefined,
    onColumnFiltersChange,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header
        stickyHeader={!!stickyHeaderOffset}
        stickyHeaderOffset={stickyHeaderOffset}
        rightSlot={<DataTable.RowCount />}
      />
      <DataTable.Body
        loading={isLoading}
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        rowClassName="mb-1"
        rowHref={ticketRowHref}
      />
      {footerSlot}
    </DataTable>
  );
}
