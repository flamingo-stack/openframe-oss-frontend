import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableSettings,
  type DataTableSortState,
  DeviceCardCompact,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  LoadingWhen,
  type NoDataProps,
  type OnChangeFn,
  type Row,
  resolveStatusTagProps,
  SquareAvatar,
  TicketStatusTag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatTicketFullTimestamp } from '@flamingo-stack/openframe-frontend-core/utils';
import { useMemo } from 'react';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { oneLineEmptyState } from '@/app/components/shared/empty-state';
import { LiveTable, type LiveTableRows, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import type { InfiniteScroll } from '@/app/components/shared/no-next-page';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { Dialog } from '../types/dialog.types';
import { getTicketDeviceName } from '../utils/ticket-device-name';
import { formatTicketRowMeta } from '../utils/ticket-row-meta';
import { TICKET_STATUS_KIND } from '../utils/ticket-statistics';
import { UnassignedTicketCell } from './table-assignee-cell';
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
   * Assignee filter options (value = user id). When present (and not archived)
   * the ASSIGNEE column gets a header filter like STATUS — which also keeps its
   * header reachable on tablet, where the column body itself is `hideAt: 'lg'`.
   */
  assigneeOptions?: StatusFilterOption[];
  /**
   * Deleted-user probe from `useUserStatusMap` — the ticket payload only
   * carries a denormalized assignee snapshot (id + name), no status. When it
   * answers true for `assignedTo`, the assignee cell renders the deleted
   * treatment (red user-x avatar + red name).
   */
  isUserDeleted?: (id?: string | null) => boolean;
  /**
   * Renders the sort arrow on the TICKET header. Only a consumer that also
   * hands `DataTable.Header` an `onSortChange` (the /tickets list) sets it;
   * the device and customer tabs render these columns without one.
   */
  sortable?: boolean;
  /**
   * The ticket's unread client-chat messages, for the grid layout: there the count is the title cell's trailing mark
   * (in card rows it takes the open button's place, `getTicketOpenColumn`). Only the /tickets list passes it.
   */
  getUnreadCount?: (ticket: Dialog) => number | undefined;
}

/**
 * The ticket tables' data columns, shared by the /tickets list, the device and customer Tickets tabs and the
 * assignments panel. Each states what the grid layout reads beside the card layout's `meta.width`: a `size` (a
 * proposed width, to be confirmed by design), a `minSize` where the cell holds more than text, a one-line `gridCell`
 * and a `label` for the settings menu. The columns keep their `accessorKey`: the tabs pick and size them by it.
 */
export function getTicketTableColumns(options: TicketTableColumnsOptions = {}): ColumnDef<Dialog>[] {
  const {
    isArchived = false,
    statusOptions,
    assigneeOptions,
    isUserDeleted,
    sortable = false,
    getUnreadCount,
  } = options;

  const titleGrid = {
    label: 'Ticket',
    gridCell: ({ row }: { row: Row<Dialog> }) => (
      <TicketTitleGridCell ticket={row.original} getUnreadCount={getUnreadCount} />
    ),
  };
  const titleColumn: ColumnDef<Dialog> = {
    accessorKey: 'title',
    header: TICKET_COLUMNS.title.header,
    cell: ({ row }: { row: Row<Dialog> }) => <TicketTitleCell ticket={row.original} />,
    size: 420,
    // The flag is spliced into the layout entry rather than passed as `extra`:
    // `liveColumnMeta` lets the layout win on the shared fields, so an `extra`
    // `sortable` would be overwritten by the layout's (absent) one.
    meta: liveColumnMeta(sortable ? { ...TICKET_COLUMNS.title, sortable: true } : TICKET_COLUMNS.title, titleGrid),
  };

  const sourceColumn: ColumnDef<Dialog> = {
    accessorKey: 'source',
    header: TICKET_COLUMNS.source.header,
    cell: ({ row }: { row: Row<Dialog> }) => <TicketSourceCell ticket={row.original} />,
    enableSorting: false,
    size: 280,
    meta: liveColumnMeta(TICKET_COLUMNS.source, {
      label: 'Source',
      gridCell: ({ row }: { row: Row<Dialog> }) => <TicketSourceGridCell ticket={row.original} />,
    }),
  };

  const assigneeGrid = {
    label: 'Assignee',
    gridCell: ({ row }: { row: Row<Dialog> }) => (
      <TicketAssigneeGridCell ticket={row.original} isArchived={isArchived} isUserDeleted={isUserDeleted} />
    ),
  };
  const middleColumn: ColumnDef<Dialog> = {
    accessorKey: 'assignee',
    header: TICKET_COLUMNS.assignee.header,
    cell: ({ row }: { row: Row<Dialog> }) => (
      <TicketAssigneeCell ticket={row.original} isArchived={isArchived} isUserDeleted={isUserDeleted} />
    ),
    enableSorting: false,
    size: 280,
    minSize: GRID_MIN_WIDTH.media,
    meta: liveColumnMeta(TICKET_COLUMNS.assignee, assigneeGrid),
    // Filtering itself is server-side (`clientSideFiltering` is off — TanStack
    // only stores the state); the filterFn mirrors the STATUS column for shape.
    ...(!isArchived &&
      assigneeOptions && {
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(TICKET_COLUMNS.assignee, {
          ...assigneeGrid,
          filter: { options: assigneeOptions },
        }),
      }),
  };

  const statusGrid = {
    label: 'Status',
    // The tag is one line already: the grid cell is the tag.
    gridCell: ({ row }: { row: Row<Dialog> }) => (
      <DataTable.Cell tag={<TicketStatusTag {...resolveStatusTagProps(row.original)} />} />
    ),
  };
  const statusColumn: ColumnDef<Dialog> = {
    accessorKey: 'status',
    header: TICKET_COLUMNS.status.header,
    cell: ({ row }: { row: Row<Dialog> }) => <TicketStatusTag {...resolveStatusTagProps(row.original)} />,
    size: 180,
    meta: liveColumnMeta(TICKET_COLUMNS.status, statusGrid),
    ...(!isArchived && {
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(TICKET_COLUMNS.status, {
        ...statusGrid,
        filter: { options: statusOptions ?? LEGACY_STATUS_FILTER_OPTIONS },
      }),
    }),
  };

  return [titleColumn, sourceColumn, middleColumn, statusColumn];
}

/**
 * The title over `<number> • <time>`; both lines draw their bars while the row is read. A ticket not read yet (no
 * creation time) has no title to fall back from: its line is empty, so `TruncateText` draws its bar.
 */
function TicketTitleCell({ ticket }: { ticket: Dialog }) {
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{ticket.title || (ticket.createdAt ? 'Untitled Ticket' : '')}</TruncateText>
      {/* The sub-line only carries a relative time, so the full timestamp
          rides on hover exactly as on the board card. A native title, not
          TruncateText's tooltip: that one fires only when the text overflows. */}
      <div className="min-w-0" title={ticket.createdAt ? formatTicketFullTimestamp(ticket.createdAt) : undefined}>
        <TruncateText variant="h6" tone="secondary">
          {formatTicketRowMeta(ticket)}
        </TruncateText>
      </div>
    </div>
  );
}

/**
 * The title cell's grid form, on one line: the title, `<number> • <time>` beside it, and (on the /tickets list) the
 * count of unread client-chat messages at the end of the line. The full creation time rides on hover, as it does on
 * the card row's sub-line. A ticket not read yet has an empty title, which draws its bar.
 */
function TicketTitleGridCell({
  ticket,
  getUnreadCount,
}: {
  ticket: Dialog;
  getUnreadCount?: (ticket: Dialog) => number | undefined;
}) {
  const loading = useLoadingScope();
  const unread = loading ? undefined : getUnreadCount?.(ticket);
  return (
    <div
      className="flex min-w-0 flex-1"
      title={ticket.createdAt ? formatTicketFullTimestamp(ticket.createdAt) : undefined}
    >
      <DataTable.Cell
        text={ticket.title || (ticket.createdAt ? 'Untitled Ticket' : '')}
        secondary={formatTicketRowMeta(ticket) || undefined}
        trailing={unread ? <TicketUnreadMark count={unread} /> : undefined}
      />
    </div>
  );
}

/** What the unread count is called: the same name on the card row's block and the grid's mark. */
const unreadLabel = (count: number) => `${count} unread ${count === 1 ? 'message' : 'messages'}`;
/** The count as it is printed: capped, so the mark keeps its width. */
const unreadText = (count: number) => (count > 99 ? '99+' : count);

/** The unread count in a grid row: a small accent mark at the end of the title's line. */
function TicketUnreadMark({ count }: { count: number }) {
  return (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ods-accent px-[var(--spacing-system-xsf)] font-bold text-ods-text-on-accent text-h6"
      aria-label={unreadLabel(count)}
    >
      {unreadText(count)}
    </span>
  );
}

/** The reporting device over its customer (`DeviceCardCompact`'s box); two bars while the row is read. */
function TicketSourceCell({ ticket }: { ticket: Dialog }) {
  if (useLoadingScope()) {
    return (
      <div className="flex min-h-[60px] flex-col justify-center gap-1 py-2">
        <TextLineSkeleton type="h6" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-1/2" />
      </div>
    );
  }
  return (
    <DeviceCardCompact deviceName={getTicketDeviceName(ticket) || EMPTY_VALUE} organization={ticket.organizationName} />
  );
}

/** The source cell's grid form, on one line: the reporting device, its customer beside it. */
function TicketSourceGridCell({ ticket }: { ticket: Dialog }) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  return (
    <DataTable.Cell
      text={getTicketDeviceName(ticket) || EMPTY_VALUE}
      secondary={ticket.organizationName || undefined}
    />
  );
}

interface TicketAssigneeCellProps {
  ticket: Dialog;
  isArchived: boolean;
  isUserDeleted?: (id?: string | null) => boolean;
}

/** The assignee's avatar and name; the avatar's and the name's bars while the row is read (no assign picker). */
function TicketAssigneeCell({ ticket, isArchived, isUserDeleted }: TicketAssigneeCellProps) {
  if (useLoadingScope()) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <SquareAvatar alt="" size="sm" variant="round" className="shrink-0" />
        <TextLineSkeleton type="h4" className="w-3/4" />
      </div>
    );
  }
  const isDeletedAssignee = isUserDeleted?.(ticket.assignedTo) ?? false;
  if (ticket.assignedName) {
    // Assigned: display only — re-assigning lives on the details page.
    return (
      <div className="flex min-w-0 items-center gap-2">
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
        <TruncateText className={isDeletedAssignee ? 'text-ods-error' : undefined}>{ticket.assignedName}</TruncateText>
      </div>
    );
  }
  // AI Handling rows offer no assignee affordance at all — the AI owns the
  // ticket (the board hides the card's assign slot the same way). An empty
  // cell, per design — not even a dash.
  if (ticket.statusKind === TICKET_STATUS_KIND.AI_ASSISTANCE) return null;
  // Unassigned: the ghost avatar + label, with the first assignment offered
  // right here (the board card's affordance). Not for archived rows. The AI
  // Handling early-return above already covers the take-over case - outside
  // that kind the AI is stopped and assigning is a plain change.
  return <UnassignedTicketCell ticketId={ticket.id} interactive={!isArchived} />;
}

/**
 * The assignee cell's grid form, on one line: the avatar and the name. The deleted mark is not one of the cell's
 * leading kinds, so it sits before the cell; an unassigned ticket keeps its first-assignment picker.
 */
function TicketAssigneeGridCell({ ticket, isArchived, isUserDeleted }: TicketAssigneeCellProps) {
  if (useLoadingScope()) return <DataTable.Cell leading={{ type: 'avatar', name: '' }} text="" />;
  if (ticket.assignedName) {
    if (isUserDeleted?.(ticket.assignedTo)) {
      return (
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
          <DeletedUserAvatar size="sm" />
          <DataTable.Cell text={ticket.assignedName} />
        </div>
      );
    }
    return (
      <DataTable.Cell
        leading={{
          type: 'avatar',
          src: getFullImageUrl(ticket.assigneeImageUrl, ticket.assigneeImageHash),
          name: ticket.assignedName,
        }}
        text={ticket.assignedName}
      />
    );
  }
  // As in the card row: the AI owns an AI Handling ticket, so the cell is empty.
  if (ticket.statusKind === TICKET_STATUS_KIND.AI_ASSISTANCE) return null;
  return <UnassignedTicketCell ticketId={ticket.id} interactive={!isArchived} />;
}

export const ticketRowHref = (ticket: Dialog): string => routes.tickets.dialog(ticket.id);

/**
 * The trailing open-in-new-tab column. In card rows it is the outlined button (or the unread count in its place),
 * hidden below `md`. In the grid it is an action column: 56px, pinned right, never hidden and not in the settings
 * menu, holding the button alone (the count is the title cell's mark). Kept by hand rather than built with the lib's
 * `actionColumn()`, which sets no `hideAt` and would show the button in card rows that hide it.
 */
export function getTicketOpenColumn(getUnreadCount?: (ticket: Dialog) => number | undefined): ColumnDef<Dialog> {
  return {
    id: TICKET_COLUMNS.open.id,
    cell: ({ row }: { row: Row<Dialog> }) => <TicketOpenCell ticket={row.original} getUnreadCount={getUnreadCount} />,
    enableSorting: false,
    enableHiding: false,
    size: GRID_ACTION_COLUMN_SIZE,
    meta: liveColumnMeta(TICKET_COLUMNS.open, {
      gridKind: 'action',
      gridCell: ({ row }: { row: Row<Dialog> }) => (
        <OpenRowButton grid label="Open in new tab" onClick={openInNewTab(ticketRowHref(row.original))} />
      ),
    }),
  };
}

/**
 * The trailing slot: the unread-message count when there is one, otherwise the open action. While the row is read the
 * open button is static chrome: drawn real, and inert.
 */
function TicketOpenCell({
  ticket,
  getUnreadCount,
}: {
  ticket: Dialog;
  getUnreadCount?: (ticket: Dialog) => number | undefined;
}) {
  const loading = useLoadingScope();
  const unread = loading ? undefined : getUnreadCount?.(ticket);
  if (unread) {
    return (
      <span
        className="inline-flex h-12 min-w-12 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)] font-bold text-ods-text-on-accent text-h3"
        aria-label={unreadLabel(unread)}
      >
        {unreadText(unread)}
      </span>
    );
  }
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(ticketRowHref(ticket))}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
        disabled={loading}
      />
    </div>
  );
}

const DEFAULT_EMPTY_STATE = oneLineEmptyState('No tickets found.');

type TicketTableBodyProps = TicketTableBodyOptions & LiveTableRows;

interface TicketTableBodyOptions {
  tickets: Dialog[];
  /** The first page is a client read that has not answered: the table draws its own loading state. */
  isLoading?: boolean;
  /** A new key is being read and the rows on screen are the previous key's: the table dims them. */
  isPending?: boolean;
  /** The empty state's copy (`NoData`): a title, and a description when the table has one. */
  emptyState?: NoDataProps;
  /** Pins the column header below the page's sticky toolbar; without it the header scrolls with the rows. */
  stickyHeaderOffset?: string;
  /** The next page's infinite scroll. */
  infiniteScroll?: InfiniteScroll;
  isArchived?: boolean;
  actionsColumn?: ColumnDef<Dialog>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  statusOptions?: StatusFilterOption[];
  assigneeOptions?: StatusFilterOption[];
  getUnreadCount?: (ticket: Dialog) => number | undefined;
  /**
   * Server-side sort indicator for the TICKET header. The header only renders
   * the direction; the consumer owns the click cycle and the query. Passing
   * `onSortChange` is what makes the header sortable at all.
   */
  sort?: DataTableSortState | null;
  onSortChange?: (columnId: string) => void;
  /**
   * The table's layout (`useGridTableProps`). `grid` draws the lib's grid table: one line in every cell, the open
   * action pinned right, the unread count at the end of the title. Default `cards`.
   */
  layout?: TableLayout;
  /** Grid only: `'fill'` makes the table the page's scroll area. */
  maxHeight?: number | string;
  /** Grid only: the settings gear, with the viewer's column layout kept under the table's own key. */
  settings?: DataTableSettings;
}

export function TicketTableBody(props: TicketTableBodyProps) {
  const {
    tickets,
    isLoading,
    isPending,
    emptyState = DEFAULT_EMPTY_STATE,
    stickyHeaderOffset,
    infiniteScroll,
    isArchived,
    actionsColumn,
    columnFilters,
    onColumnFiltersChange,
    statusOptions,
    assigneeOptions,
    getUnreadCount,
    sort,
    onSortChange,
    layout,
    maxHeight,
    settings,
  } = props;
  // A paged list draws its page size, a list read whole its typical count (`LiveTableRows`).
  const rows = props.skeletonRows === undefined ? { pageSize: props.pageSize } : { skeletonRows: props.skeletonRows };
  const { isUserDeleted } = useUserStatusMap(tickets.map(ticket => ticket.assignedTo));
  const sortable = !!onSortChange;

  const columns = useMemo<ColumnDef<Dialog>[]>(() => {
    const base = getTicketTableColumns({
      isArchived,
      statusOptions,
      assigneeOptions,
      isUserDeleted,
      sortable,
      getUnreadCount,
    });
    const openColumn = getTicketOpenColumn(getUnreadCount);
    return actionsColumn ? [...base, actionsColumn, openColumn] : [...base, openColumn];
  }, [isArchived, actionsColumn, statusOptions, assigneeOptions, getUnreadCount, isUserDeleted, sortable]);

  // While the first page is read the table holds one page of placeholder rows, drawn with the real cells.
  const loadingCount = props.skeletonRows ?? props.pageSize;
  const loadingRows = useMemo(
    () => (isLoading ? loadingPlaceholderRows<Dialog>(loadingCount) : null),
    [isLoading, loadingCount],
  );

  const table = useDataTable<Dialog>({
    data: loadingRows ?? tickets,
    columns,
    getRowId: row => String(row.id),
    enableSorting: false,
    state: columnFilters !== undefined ? { columnFilters } : undefined,
    onColumnFiltersChange,
  });

  return (
    <LoadingWhen loading={!!isLoading}>
      <LiveTable
        table={table}
        {...rows}
        isPending={isPending}
        stickyHeader={!!stickyHeaderOffset}
        stickyHeaderOffset={stickyHeaderOffset}
        sort={sort}
        onSortChange={onSortChange}
        emptyState={emptyState}
        rowHref={ticketRowHref}
        footer={infiniteScroll}
        loadingCells={!!isLoading}
        layout={layout}
        maxHeight={maxHeight}
        settings={settings}
      />
    </LoadingWhen>
  );
}
