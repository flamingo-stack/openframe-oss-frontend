'use client';

import { Chevron02RightIcon, TicketIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
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
import { EmptyValue } from '@/app/components/shared/empty-value';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { matchesTicketSearch, type RecordingTicket } from './recording-tickets';

/** Column layout per Figma 1755-93683: TICKET takes the rest, ASSIGNED 280, STATUS 200, two buttons. */
const RECORDING_TICKET_COLUMNS = {
  ticket: { id: 'ticket', header: 'TICKET', width: 'flex-1 min-w-0', sortable: true },
  assigned: { id: 'assigned', header: 'ASSIGNED', width: 'w-[280px] shrink-0', hideAt: 'lg', filterable: true },
  status: { id: 'status', header: 'STATUS', width: 'w-[200px] shrink-0', hideAt: 'lg', filterable: true },
  actions: { id: 'actions', width: 'w-[112px] shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

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

function recordingTicketColumns({
  tickets,
  onOpen,
  onUnassign,
}: {
  tickets: RecordingTicket[];
  onOpen: (ticket: RecordingTicket) => void;
  onUnassign: (ticket: RecordingTicket) => void;
}): ColumnDef<RecordingTicket>[] {
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
      meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.ticket),
    },
    {
      id: RECORDING_TICKET_COLUMNS.assigned.id,
      header: RECORDING_TICKET_COLUMNS.assigned.header,
      accessorFn: ticket => ticket.assignedName ?? UNASSIGNED,
      cell: ({ row }: { row: Row<RecordingTicket> }) => {
        const name = row.original.assignedName;
        if (!name) {
          return (
            <span className="text-h4">
              <EmptyValue />
            </span>
          );
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
      meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.assigned, {
        filter: { options: filterOptions(tickets.map(ticket => ticket.assignedName ?? UNASSIGNED)) },
      }),
    },
    {
      id: RECORDING_TICKET_COLUMNS.status.id,
      header: RECORDING_TICKET_COLUMNS.status.header,
      accessorFn: ticket => ticket.statusName ?? '',
      cell: ({ row }: { row: Row<RecordingTicket> }) => <TicketStatusTag {...resolveStatusTagProps(row.original)} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(RECORDING_TICKET_COLUMNS.status, {
        filter: { options: filterOptions(tickets.flatMap(ticket => (ticket.statusName ? [ticket.statusName] : []))) },
      }),
    },
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
}

interface RecordingTicketsSectionProps {
  tickets: RecordingTicket[];
  onUnassign: (ticket: RecordingTicket) => void;
}

/**
 * "Assigned Tickets" under the recording (Figma 1755-93683): the tickets
 * linked to the session, searchable by title or number, filterable by
 * assignee and status. The caller leaves it out when there are none.
 */
export function RecordingTicketsSection({ tickets, onUnassign }: RecordingTicketsSectionProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const rows = tickets.filter(ticket => matchesTicketSearch(ticket, search));
  const columns = recordingTicketColumns({
    tickets,
    onOpen: ticket => router.push(routes.tickets.dialog(ticket.id)),
    onUnassign,
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
      <DataTable table={table}>
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
          rowClassName="mb-1"
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
