'use client';

import { Chevron02RightIcon, TicketIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  actionColumn,
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableSettings,
  FloatingTooltip,
  GRID_MIN_WIDTH,
  type Row,
  resolveStatusTagProps,
  SearchInput,
  type SortingState,
  SquareAvatar,
  TicketStatusTag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatTicketFullTimestamp } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatTicketRowMeta } from '@/app/(app)/tickets/utils/ticket-row-meta';
import { GridRowActionButton } from '@/app/components/shared/grid-row-action-button';
import { LIVE_ROW_GAP_CLASS } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { ValueGridCell } from '@/app/components/shared/value-grid-cell';
import { ValueText } from '@/app/components/shared/value-text';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { matchesTicketSearch, type RecordingTicket } from './recording-tickets';

/** Column layout per Figma 1755-93683: TICKET takes the rest, ASSIGNED 280, STATUS 200, two buttons. */
const RECORDING_TICKET_COLUMNS = {
  ticket: { id: 'ticket', header: 'TICKET', width: 'flex-1 min-w-0', sortable: true },
  assigned: { id: 'assigned', header: 'ASSIGNED', width: 'w-[280px] shrink-0', hideAt: 'lg' },
  status: { id: 'status', header: 'STATUS', width: 'w-[200px] shrink-0', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-[112px] shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order, resized
 * widths) kept in the browser under this table's own key.
 */
const RECORDING_TICKETS_TABLE_SETTINGS: DataTableSettings = { storageKey: 'recording-tickets' };

/** The ASSIGNED funnel's value for a ticket nobody holds. */
const UNASSIGNED = 'Unassigned';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** The distinct values of a column, as its funnel's options. */
function filterOptions(values: string[]) {
  return [...new Set(values)].sort().map(value => ({ id: value, value, label: value }));
}

/** The grid's one line: the title, then "3891 • 5 min ago" (the full creation time on hover, as in a card row). */
function TicketGridCell({ ticket }: { ticket: RecordingTicket }) {
  const meta = formatTicketRowMeta(ticket);
  const cell = <DataTable.Cell text={ticket.title} secondary={meta || undefined} />;
  if (!ticket.createdAt) return cell;
  return (
    <FloatingTooltip content={formatTicketFullTimestamp(ticket.createdAt)} triggerClassName="flex min-w-0 flex-1">
      {cell}
    </FloatingTooltip>
  );
}

function recordingTicketColumns({
  tickets,
  onOpen,
  onUnassign,
  layout,
}: {
  tickets: RecordingTicket[];
  onOpen: (ticket: RecordingTicket) => void;
  onUnassign: (ticket: RecordingTicket) => void;
  /** `grid`: Unassign and Open are a column each (the grid's action columns); `cards`: the one actions column. */
  layout: TableLayout;
}): ColumnDef<RecordingTicket>[] {
  const actionColumns: ColumnDef<RecordingTicket>[] =
    layout === 'grid'
      ? [
          actionColumn<RecordingTicket>({
            id: 'unassign',
            cell: ({ row }) => (
              <GridRowActionButton
                label="Unassign ticket"
                icon={<TrashIcon className="h-6 w-6 text-ods-error" />}
                onClick={() => onUnassign(row.original)}
              />
            ),
          }),
          actionColumn<RecordingTicket>({
            id: 'open',
            cell: ({ row }) => (
              <GridRowActionButton
                label="Open ticket"
                icon={<Chevron02RightIcon className="h-6 w-6" />}
                onClick={() => onOpen(row.original)}
              />
            ),
          }),
        ]
      : [
          {
            id: RECORDING_TICKET_COLUMNS.actions.id,
            cell: ({ row }: { row: Row<RecordingTicket> }) => (
              <div
                data-no-row-click
                className="pointer-events-auto flex items-center justify-end gap-[var(--spacing-system-m)]"
              >
                <Button
                  variant="outline"
                  size="icon"
                  leftIcon={<TrashIcon className="h-6 w-6 text-ods-error" />}
                  aria-label="Unassign ticket"
                  onClick={() => onUnassign(row.original)}
                />
                {/* onClick, not `href`: the row itself is a link (rowHref), and an
                    anchor nested in an anchor is invalid HTML. */}
                <Button
                  variant="outline"
                  size="icon"
                  leftIcon={<Chevron02RightIcon className="h-6 w-6" />}
                  aria-label="Open ticket"
                  onClick={() => onOpen(row.original)}
                />
              </div>
            ),
            enableSorting: false,
            meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.actions),
          },
        ];

  return [
    {
      id: RECORDING_TICKET_COLUMNS.ticket.id,
      header: RECORDING_TICKET_COLUMNS.ticket.header,
      accessorFn: ticket => ticket.ticketNumber ?? -1,
      cell: ({ row }: { row: Row<RecordingTicket> }) => {
        const { title, createdAt } = row.original;
        const meta = formatTicketRowMeta(row.original);
        return (
          <div className="flex min-w-0 flex-col justify-center">
            <TruncateText>{title}</TruncateText>
            {/* "3891 • 5 min ago" as in the tickets table, the full creation time on hover. */}
            {meta && (
              <div className="min-w-0" title={createdAt ? formatTicketFullTimestamp(createdAt) : undefined}>
                <TruncateText variant="h6" tone="secondary">
                  {meta}
                </TruncateText>
              </div>
            )}
          </div>
        );
      },
      enableSorting: true,
      size: 420,
      meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.ticket, {
        label: 'Ticket',
        gridCell: ({ row }: { row: Row<RecordingTicket> }) => <TicketGridCell ticket={row.original} />,
      }),
    },
    {
      id: RECORDING_TICKET_COLUMNS.assigned.id,
      header: RECORDING_TICKET_COLUMNS.assigned.header,
      accessorFn: ticket => ticket.assignedName ?? UNASSIGNED,
      cell: ({ row }: { row: Row<RecordingTicket> }) => {
        const name = row.original.assignedName;
        if (!name) {
          return <ValueText value={null} />;
        }
        return (
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
            <SquareAvatar
              variant="round"
              size="sm"
              src={row.original.assignedAvatarUrl ?? undefined}
              fallback={initials(name)}
              alt={name}
              className="shrink-0"
              initialsClassName="text-ods-text-secondary"
            />
            <TruncateText>{name}</TruncateText>
          </div>
        );
      },
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 280,
      minSize: GRID_MIN_WIDTH.media,
      meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.assigned, {
        label: 'Assigned',
        filter: { options: filterOptions(tickets.map(ticket => ticket.assignedName ?? UNASSIGNED)) },
        gridCell: ({ row }: { row: Row<RecordingTicket> }) => {
          const name = row.original.assignedName;
          if (!name) return <ValueGridCell value={null} />;
          return <DataTable.Cell leading={{ type: 'avatar', src: row.original.assignedAvatarUrl, name }} text={name} />;
        },
      }),
    },
    {
      id: RECORDING_TICKET_COLUMNS.status.id,
      header: RECORDING_TICKET_COLUMNS.status.header,
      accessorFn: ticket => ticket.statusName ?? '',
      cell: ({ row }: { row: Row<RecordingTicket> }) => <TicketStatusTag {...resolveStatusTagProps(row.original)} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 200,
      // One line already (a tag): the grid draws the same cell.
      meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.status, {
        label: 'Status',
        filter: { options: filterOptions(tickets.flatMap(ticket => (ticket.statusName ? [ticket.statusName] : []))) },
      }),
    },
    ...actionColumns,
  ];
}

interface RecordingTicketsSectionProps {
  tickets: RecordingTicket[];
  onUnassign: (ticket: RecordingTicket) => void;
  /**
   * The table's layout. `grid` draws the lib's grid table (48px one-line rows, the ticket column pinned, Unassign and
   * Open as action columns, the gear menu), at its natural height: the section is part of the recording's page.
   * Default `cards`.
   */
  tableLayout?: TableLayout;
}

/**
 * "Assigned Tickets" under the recording (Figma 1755-93683): the tickets
 * linked to the session, searchable by title or number, filterable by
 * assignee and status. The caller leaves it out when there are none.
 */
export function RecordingTicketsSection({ tickets, onUnassign, tableLayout = 'cards' }: RecordingTicketsSectionProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const rows = tickets.filter(ticket => matchesTicketSearch(ticket, search));
  const columns = recordingTicketColumns({
    tickets,
    onOpen: ticket => router.push(routes.tickets.dialog(ticket.id)),
    onUnassign,
    layout: tableLayout,
  });
  const table = useDataTable<RecordingTicket>({
    data: rows,
    columns,
    getRowId: ticket => ticket.id,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });
  // The header only draws the indicator; TanStack applies the sort from the state.
  const sortState = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;

  return (
    <section className="flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]">
      <h2 className="truncate text-ods-text-primary text-h2">Assigned Tickets</h2>
      <SearchInput value={search} onChange={setSearch} placeholder="Search for Tickets" showDropdown={false} />
      {/* The settings belong to the grid; the table keeps its natural height in both layouts. */}
      <DataTable
        table={table}
        layout={tableLayout}
        settings={tableLayout === 'grid' ? RECORDING_TICKETS_TABLE_SETTINGS : undefined}
      >
        {/* The grid's results count sits above the table; the card header carries its own (`rightSlot`). */}
        {tableLayout === 'grid' && (
          <DataTable.Meta>
            <DataTable.RowCount itemName="result" />
          </DataTable.Meta>
        )}
        <DataTable.Header
          sort={sortState}
          onSortChange={(id: string) =>
            setSorting(current =>
              current[0]?.id !== id ? [{ id, desc: false }] : current[0].desc ? [] : [{ id, desc: true }],
            )
          }
          rightSlot={<DataTable.RowCount itemName="result" />}
        />
        <DataTable.Body
          rowClassName={LIVE_ROW_GAP_CLASS}
          rowHref={(ticket: RecordingTicket) => routes.tickets.dialog(ticket.id)}
          emptyState={{
            icon: <TicketIcon />,
            title: 'No tickets found',
            description: 'No assigned ticket matches the search or the filters.',
          }}
        />
      </DataTable>
    </section>
  );
}
