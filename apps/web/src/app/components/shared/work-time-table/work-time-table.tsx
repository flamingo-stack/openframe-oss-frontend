'use client';

import { LoadingSuspense, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ChartDonutIcon,
  ClockHistoryIcon,
  Filter01ListIcon,
  PenEditIcon,
  SearchIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  actionColumn,
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DashboardInfoCard,
  DataTable,
  type DataTableFilterOption,
  DatePicker,
  type DateRange,
  EntityImage,
  GRID_MIN_WIDTH,
  Input,
  LoadError,
  LoadingWhen,
  type OnChangeFn,
  SquareAvatar,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { format, isValid, parseISO } from 'date-fns';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type { deleteTimeEntryMutation as DeleteTimeEntryMutationType } from '@/__generated__/deleteTimeEntryMutation.graphql';
import type { employeeWorkTimeRelay_query$key } from '@/__generated__/employeeWorkTimeRelay_query.graphql';
import type { employeeWorkTimeRelayPaginationQuery } from '@/__generated__/employeeWorkTimeRelayPaginationQuery.graphql';
import type { employeeWorkTimeRelayQuery as EmployeeWorkTimeRelayQueryType } from '@/__generated__/employeeWorkTimeRelayQuery.graphql';
import { customerContactEmail } from '@/app/(app)/customers/utils/customer-contact-email';
import { ASSIGNEE_FILTER_PAGE_SIZE, useAssigneeOptions } from '@/app/(app)/tickets/hooks/use-assignee-options';
import { useOrganizationOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { type ManualEntryEditTarget, ManualEntryModal } from '@/app/components/manual-entry-modal';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { EmptyState, oneLineEmptyState } from '@/app/components/shared/empty-state';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useGridTableProps, useTableGridGate } from '@/app/hooks/use-table-layout';
import { deleteTimeEntryMutation } from '@/graphql/time-tracker/delete-time-entry-mutation';
import {
  employeeWorkTimeRelayFragment,
  employeeWorkTimeRelayQuery,
} from '@/graphql/time-tracker/employee-work-time-relay';
import {
  formatDurationLabel,
  makeDeleteTimeEntryUpdater,
  subscribeTimeEntriesChanged,
  toInstantRange,
  toOrganizationGlobalId,
} from '@/graphql/time-tracker/time-tracker-helpers';
import { formatDate } from '@/lib/format-date';
import type { Instant } from '@/lib/graphql-scalars';
import { getFullImageUrl } from '@/lib/image-url';
import { decodeGlobalId, ensureGlobalIdForType } from '@/lib/relay-id';
import { LiveTable, loadingPlaceholderRows } from '../live-table';
import { type InfiniteScroll, NO_ITEMS, NO_NEXT_PAGE, noop } from '../no-next-page';

const PAGE_SIZE = 20;

/** The stat figures the query answers, as numbers (the query's Long fields read as strings or numbers). */
interface WorkTimeStats {
  todayTotalSeconds: string | number;
  todayEntryCount: string | number;
  periodTotalSeconds: string | number;
  periodEntryCount: string | number;
  averagePerDaySeconds: string | number;
}

/**
 * The three stat cards above the table, in order: one list for the loaded cards and their loading state. Titles
 * are static (drawn for real while loading); the duration and the entry count are read. `AVG. PER DAY` has no
 * entry count.
 */
const STAT_CARDS: ReadonlyArray<{
  title: string;
  seconds: (stats: WorkTimeStats) => string | number;
  entries?: (stats: WorkTimeStats) => string | number;
}> = [
  { title: 'TODAY TOTAL', seconds: stats => stats.todayTotalSeconds, entries: stats => stats.todayEntryCount },
  { title: 'PERIOD TOTAL', seconds: stats => stats.periodTotalSeconds, entries: stats => stats.periodEntryCount },
  { title: 'AVG. PER DAY', seconds: stats => stats.averagePerDaySeconds },
];
const DAY_PARAM_FORMAT = 'yyyy-MM-dd';

function formatDayParam(date: Date | undefined): string | null {
  return date ? format(date, DAY_PARAM_FORMAT) : null;
}

function rangeFromParams(from: string, to: string): DateRange | undefined {
  const fromDate = from ? parseISO(from) : undefined;
  if (!fromDate || !isValid(fromDate)) return undefined;
  const toDate = to ? parseISO(to) : undefined;
  return { from: fromDate, to: toDate && isValid(toDate) ? toDate : undefined };
}

interface WorkTimeRow {
  id: string;
  durationSeconds: number;
  startedAt: Instant;
  ticketId: string | null;
  ticketNumber: number | null;
  ticketTitle: string | null;
  notes: string | null;
  /** Raw user id (matches assignee-option values), for editing/reassigning the employee. */
  userId: string | null;
  userName: string | null;
  /** Raw `User.status` from the payload (ACTIVE / DELETED / SELF_DELETED). */
  userStatus: string | null;
  userEmail: string | null;
  userImageUrl?: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationEmail: string | null;
  organizationImageUrl?: string;
}

interface WorkTimeFilter {
  employeeIds: string[] | null;
  organizationIds: string[] | null;
  startedFrom: Instant | null;
  startedTo: Instant | null;
}

interface QueryVars {
  filter: WorkTimeFilter;
  search: string | null;
  first: number;
  after: string | null;
}

function EmployeeCell({ row }: { row: WorkTimeRow }) {
  // A row still being read: the avatar and both lines draw their own loading forms.
  const loading = useLoadingScope();
  const isDeleted = !loading && isDeletedUserStatus(row.userStatus);

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      {isDeleted ? (
        <DeletedUserAvatar size="sm" />
      ) : (
        <SquareAvatar src={row.userImageUrl} fallback={row.userName ?? '?'} size="sm" variant="round" />
      )}
      <div className="flex min-w-0 flex-col">
        {/* An entry not read yet (no start) has no name to dash: the empty line draws its bar. */}
        <TruncateText>{row.userName ?? (row.startedAt ? '–' : '')}</TruncateText>
        {/* SELF_DELETED emails are synthetic (`deleted-{id}@deleted.invalid`) — hidden. */}
        {(loading || (row.userEmail && !isSelfDeletedUserStatus(row.userStatus))) && (
          <TruncateText variant="h6" tone="secondary" mono>
            {row.userEmail ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/**
 * The employee cell's grid form, on one line: the avatar, the name, the email beside it. The deleted mark is not one
 * of the cell's leading kinds, so it sits before the cell.
 */
function EmployeeGridCell({ row }: { row: WorkTimeRow }) {
  if (useLoadingScope()) return <DataTable.Cell leading={{ type: 'avatar', name: '' }} text="" />;
  const name = row.userName ?? '–';
  // SELF_DELETED emails are synthetic (`deleted-{id}@deleted.invalid`): hidden, as in the card row.
  const email = row.userEmail && !isSelfDeletedUserStatus(row.userStatus) ? row.userEmail : undefined;
  if (isDeletedUserStatus(row.userStatus)) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
        <DeletedUserAvatar size="sm" />
        <DataTable.Cell text={name} secondary={email} />
      </div>
    );
  }
  return (
    <DataTable.Cell
      leading={{ type: 'avatar', src: row.userImageUrl, name: row.userName ?? '?' }}
      text={name}
      secondary={email}
    />
  );
}

/*
 * The data columns. Each states what the grid layout reads beside the card layout's `meta.width`: a `size` (a
 * proposed width, to be confirmed by design), a `minSize` where the cell holds more than text, a one-line `gridCell`
 * and a `label` for the settings menu.
 */
const employeeColumn: ColumnDef<WorkTimeRow> = {
  id: 'employee',
  header: 'EMPLOYEE',
  cell: ({ row }) => <EmployeeCell row={row.original} />,
  enableSorting: false,
  size: 280,
  minSize: GRID_MIN_WIDTH.media,
  meta: {
    width: 'min-w-0 flex-1',
    label: 'Employee',
    gridCell: ({ row }) => <EmployeeGridCell row={row.original} />,
  },
};

const timeColumn: ColumnDef<WorkTimeRow> = {
  id: 'time',
  header: 'TIME',
  cell: ({ row }) => <TimeCell row={row.original} />,
  enableSorting: false,
  size: 200,
  meta: {
    width: 'w-24 content-md:w-32 shrink-0 flex-none',
    label: 'Time',
    gridCell: ({ row }) => <TimeGridCell row={row.original} />,
  },
};

const customerColumn: ColumnDef<WorkTimeRow> = {
  id: 'customer',
  header: 'CUSTOMER',
  cell: ({ row }) => <CustomerCell row={row.original} />,
  enableSorting: false,
  size: 280,
  minSize: GRID_MIN_WIDTH.media,
  meta: {
    width: 'min-w-0 flex-1',
    hideAt: 'md',
    label: 'Customer',
    gridCell: ({ row }) => <CustomerGridCell row={row.original} />,
  },
};

const ticketNotesColumn: ColumnDef<WorkTimeRow> = {
  id: 'ticketNotes',
  header: 'TICKET & NOTES',
  cell: ({ row }) => <TicketNotesCell row={row.original} />,
  enableSorting: false,
  size: 360,
  meta: {
    width: 'min-w-0 flex-1',
    hideAt: 'md',
    label: 'Ticket & notes',
    gridCell: ({ row }) => <TicketNotesGridCell row={row.original} />,
  },
};

/** The duration over the day it was logged; two bars while the row is read. */
function TimeCell({ row }: { row: WorkTimeRow }) {
  if (useLoadingScope()) {
    return (
      <div className="flex flex-col">
        <TextLineSkeleton type="h4" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-1/2" />
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="font-mono text-ods-text-primary text-h4">{formatDurationLabel(row.durationSeconds)}</span>
      <span className="text-ods-text-secondary text-h6">{formatDate(row.startedAt)}</span>
    </div>
  );
}

/** The time cell's grid form, on one line: the duration, the day it was logged beside it. */
function TimeGridCell({ row }: { row: WorkTimeRow }) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  return <DataTable.Cell text={formatDurationLabel(row.durationSeconds)} secondary={formatDate(row.startedAt)} />;
}

/** The customer's image, name and email; each its own loading form while the row is read. */
function CustomerCell({ row }: { row: WorkTimeRow }) {
  const loading = useLoadingScope();
  const { organizationName, organizationEmail, organizationImageUrl } = row;
  if (!loading && !organizationName) return <span className="text-ods-text-secondary text-h4">–</span>;
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <EntityImage src={organizationImageUrl} alt={organizationName ?? ''} className="size-12 content-md:size-12" />
      <div className="flex min-w-0 flex-col">
        <TruncateText>{organizationName ?? ''}</TruncateText>
        {(loading || organizationEmail) && (
          <TruncateText variant="h6" tone="secondary" mono>
            {organizationEmail ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The customer cell's grid form, on one line: the logo, the name, the contact email beside it. */
function CustomerGridCell({ row }: { row: WorkTimeRow }) {
  if (useLoadingScope()) return <DataTable.Cell leading={{ type: 'image', alt: '' }} text="" />;
  const { organizationName, organizationEmail, organizationImageUrl } = row;
  if (!organizationName) return <DataTable.Cell text="–" />;
  return (
    <DataTable.Cell
      leading={{ type: 'image', src: organizationImageUrl, alt: organizationName }}
      text={organizationName}
      secondary={organizationEmail ?? undefined}
    />
  );
}

/** The ticket & notes cell's grid form, on one line: the ticket, the entry's notes beside it. */
function TicketNotesGridCell({ row }: { row: WorkTimeRow }) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  const { ticketNumber, ticketTitle, notes } = row;
  const ticketLabel = ticketTitle ? `${ticketNumber != null ? `${ticketNumber} – ` : ''}${ticketTitle}` : '–';
  return <DataTable.Cell text={ticketLabel} secondary={notes ?? undefined} />;
}

/** The ticket over the entry's notes; both draw their bars while the row is read. */
function TicketNotesCell({ row }: { row: WorkTimeRow }) {
  const loading = useLoadingScope();
  const { ticketNumber, ticketTitle, notes } = row;
  // An entry not read yet (no start) has no ticket to dash: the empty line draws its bar.
  const noTicket = row.startedAt ? '–' : '';
  const ticketLabel = ticketTitle ? `${ticketNumber != null ? `${ticketNumber} – ` : ''}${ticketTitle}` : noTicket;
  return (
    <div className="flex min-w-0 flex-col">
      <TruncateText>{ticketLabel}</TruncateText>
      {(loading || notes) && (
        <TruncateText variant="h6" tone="secondary">
          {notes ?? ''}
        </TruncateText>
      )}
    </div>
  );
}

/** Delete and edit. Static chrome: drawn real while the row is read, and inert. */
function EntryActionsCell({
  row,
  onEdit,
  onDelete,
}: {
  row: WorkTimeRow;
  onEdit: (row: WorkTimeRow) => void;
  onDelete: (row: WorkTimeRow) => void;
}) {
  const loading = useLoadingScope();
  return (
    <div className="flex items-center justify-end gap-[var(--spacing-system-xs)]">
      <Button
        variant="outline"
        size="icon"
        className="bg-ods-card"
        aria-label="Delete Entry"
        leftIcon={<TrashIcon className="h-5 w-5 text-ods-error" />}
        onClick={() => onDelete(row)}
        disabled={loading}
      />
      <Button
        variant="outline"
        size="icon"
        className="bg-ods-card"
        aria-label="Edit Entry"
        leftIcon={<PenEditIcon className="h-5 w-5" />}
        onClick={() => onEdit(row)}
        disabled={loading}
      />
    </div>
  );
}

/**
 * One entry action in the grid's action column: the 40px button with no border or fill of its own (the column is the
 * box). Static chrome: drawn real while the row is read, and inert.
 */
function EntryActionButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        variant="transparent"
        size="icon"
        className="size-10 border-0 md:size-10"
        aria-label={label}
        leftIcon={icon}
        onClick={loading ? undefined : onClick}
        disabled={loading}
      />
    </div>
  );
}

function buildColumns(
  showEmployee: boolean,
  showCustomer: boolean,
  onEdit: (row: WorkTimeRow) => void,
  onDelete: (row: WorkTimeRow) => void,
  employeeFilterOptions: DataTableFilterOption[] = [],
  customerFilterOptions: DataTableFilterOption[] = [],
  /** The grid layout: each action is a column of its own. Card rows keep the two buttons in one cell. */
  grid = false,
): ColumnDef<WorkTimeRow>[] {
  const actionColumns: ColumnDef<WorkTimeRow>[] = grid
    ? [
        actionColumn<WorkTimeRow>({
          id: 'delete',
          cell: ({ row }) => (
            <EntryActionButton
              label="Delete Entry"
              icon={<TrashIcon className="h-5 w-5 text-ods-error" />}
              onClick={() => onDelete(row.original)}
            />
          ),
        }),
        actionColumn<WorkTimeRow>({
          id: 'edit',
          cell: ({ row }) => (
            <EntryActionButton
              label="Edit Entry"
              icon={<PenEditIcon className="h-5 w-5" />}
              onClick={() => onEdit(row.original)}
            />
          ),
        }),
      ]
    : [
        {
          id: 'actions',
          header: '',
          cell: ({ row }) => <EntryActionsCell row={row.original} onEdit={onEdit} onDelete={onDelete} />,
          enableSorting: false,
          meta: { width: 'w-24 content-md:w-28 shrink-0 flex-none', align: 'right' },
        },
      ];

  return [
    ...(showEmployee
      ? [
          {
            ...employeeColumn,
            meta: {
              ...employeeColumn.meta,
              filter: { options: employeeFilterOptions },
            },
          },
        ]
      : []),
    timeColumn,
    ...(showCustomer
      ? [
          {
            ...customerColumn,
            meta: {
              ...customerColumn.meta,
              filter: { options: customerFilterOptions },
            },
          },
        ]
      : []),
    ticketNotesColumn,
    ...actionColumns,
  ];
}

/**
 * The key of the viewer's saved column layout. The table draws a different column set in each of its hosts (the
 * Worktime page, a customer's tab with no customer column, an employee's page with no employee column), so each set
 * keeps a layout of its own.
 */
function workTimeStorageKey(showEmployee: boolean, showCustomer: boolean): string {
  if (showEmployee && showCustomer) return 'work-time';
  if (showEmployee) return 'work-time-customer';
  if (showCustomer) return 'work-time-employee';
  return 'work-time-entries';
}

function mapUserName(
  user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined,
) {
  if (!user) return null;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || null;
}

interface WorkTimeTableDataProps {
  showEmployee: boolean;
  showCustomer: boolean;
  vars: QueryVars;
  fetchKey: number;
  onEdit: (row: WorkTimeRow) => void;
  onDelete: (row: WorkTimeRow) => void;
  employeeFilterOptions: DataTableFilterOption[];
  customerFilterOptions: DataTableFilterOption[];
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  /** The caller allows the rich empty state here — see `WorkTimeTable`. */
  richEmptyState: boolean;
}

/** The entries and the stats, with their own boundary: in its scope the reader draws the table pending. */
function WorkTimeTableData(props: WorkTimeTableDataProps) {
  return (
    <LoadingSuspense label="Loading work time">
      <WorkTimeTableDataReader {...props} />
    </LoadingSuspense>
  );
}

function WorkTimeTableDataReader(props: WorkTimeTableDataProps) {
  if (useLoadingScope()) {
    return <WorkTimeTableViewPending showEmployee={props.showEmployee} showCustomer={props.showCustomer} />;
  }
  return <WorkTimeTableDataLive {...props} />;
}

/** The query container: reads the entries and the stats, and renders {@link WorkTimeTableView} with them. */
function WorkTimeTableDataLive({ vars, fetchKey, ...viewProps }: WorkTimeTableDataProps) {
  const queryData = useLazyLoadQuery<EmployeeWorkTimeRelayQueryType>(employeeWorkTimeRelayQuery, vars, {
    fetchPolicy: 'store-and-network',
    fetchKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    employeeWorkTimeRelayPaginationQuery,
    employeeWorkTimeRelay_query$key
  >(employeeWorkTimeRelayFragment, queryData);

  const rows = useMemo<WorkTimeRow[]>(
    () =>
      data.employeeTimeEntries.edges
        .filter(edge => edge.node != null)
        .map(edge => {
          const org = edge.node.organization;
          return {
            id: edge.node.id,
            durationSeconds: Number(edge.node.durationSeconds),
            startedAt: edge.node.startedAt,
            ticketId: edge.node.ticketId ?? null,
            ticketNumber: edge.node.ticketNumber ?? null,
            ticketTitle: edge.node.ticketTitle ?? null,
            notes: edge.node.notes ?? null,
            userId: edge.node.user?.id ? (decodeGlobalId(edge.node.user.id)?.rawId ?? edge.node.user.id) : null,
            userName: mapUserName(edge.node.user),
            userStatus: edge.node.user?.status ?? null,
            userEmail: edge.node.user?.email ?? null,
            userImageUrl: getFullImageUrl(edge.node.user?.image?.imageUrl, edge.node.user?.image?.hash),
            organizationId: org?.organizationId ?? null,
            organizationName: org?.name ?? null,
            organizationEmail:
              customerContactEmail(org?.contactInformation?.contacts?.map(contact => contact?.email)) ?? null,
            organizationImageUrl: getFullImageUrl(org?.image?.imageUrl, org?.image?.hash),
          };
        }),
    [data.employeeTimeEntries.edges],
  );

  return (
    <WorkTimeTableView
      {...viewProps}
      stats={queryData.employeeTimeStats}
      rows={rows}
      totalCount={data.employeeTimeEntries.filteredCount}
      infiniteScroll={{
        hasNextPage: hasNext,
        isFetchingNextPage: isLoadingNext,
        onLoadMore: () => loadNext(PAGE_SIZE),
      }}
    />
  );
}

/**
 * The stats row and the entry table, from props. The Suspense fallback renders it with no data in a loading
 * scope: the stat cards and the table draw their own loading states (a full page of rows).
 */
function WorkTimeTableView({
  showEmployee,
  showCustomer,
  stats,
  rows,
  totalCount,
  infiniteScroll,
  onEdit,
  onDelete,
  employeeFilterOptions,
  customerFilterOptions,
  columnFilters,
  onColumnFiltersChange,
  richEmptyState,
}: Omit<WorkTimeTableDataProps, 'vars' | 'fetchKey'> & {
  /** The stats; null while they are read. */
  stats: WorkTimeStats | null;
  rows: WorkTimeRow[];
  totalCount?: number;
  infiniteScroll: InfiniteScroll;
}) {
  const loading = useLoadingScope();
  // The new grid table, behind the app's one table flag; card rows while it is off. The stat cards and the filters
  // sit above the table and two of its hosts are sections of a longer page, so the page scrolls, not the table.
  const tableGrid = useGridTableProps(workTimeStorageKey(showEmployee, showCustomer));
  const grid = tableGrid.layout === 'grid';
  const columns = useMemo(
    () =>
      buildColumns(showEmployee, showCustomer, onEdit, onDelete, employeeFilterOptions, customerFilterOptions, grid),
    [showEmployee, showCustomer, onEdit, onDelete, employeeFilterOptions, customerFilterOptions, grid],
  );
  // In a loading scope the table holds one page of placeholder rows, drawn with the real cells.
  const loadingRows = useMemo(() => (loading ? loadingPlaceholderRows<WorkTimeRow>(PAGE_SIZE) : null), [loading]);
  const table = useDataTable<WorkTimeRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: row => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  return (
    <>
      <div className="flex flex-col gap-[var(--spacing-system-m)] content-md:flex-row">
        {STAT_CARDS.map(card => (
          <DashboardInfoCard
            key={card.title}
            className="flex-1"
            title={card.title}
            value={stats ? formatDurationLabel(Number(card.seconds(stats))) : ''}
            subValue={stats && card.entries ? `${card.entries(stats)} entries` : undefined}
            loadingShowsSubValue={!!card.entries}
            valueClassName="font-mono"
          />
        ))}
      </div>

      {!loading && richEmptyState && rows.length === 0 ? (
        // No footer button: the other sections link their onboarding guide here, and
        // Worktime has no guide article to link to (`ONBOARDING_GUIDE_SLUGS` has no
        // entry for it), so the block ends with the bullets.
        <EmptyState
          icon={<ClockHistoryIcon />}
          title="No work time yet"
          description="Time logged against tickets and customers — from the timer or added by hand — is collected here, with the totals above kept in step."
          actions={[
            { icon: <ClockHistoryIcon />, label: 'Log time against a ticket, a customer, or neither' },
            { icon: <Filter01ListIcon />, label: 'Filter by employee, customer, or date range' },
            { icon: <ChartDonutIcon />, label: 'Track daily totals and the average per day' },
          ]}
        />
      ) : (
        <LiveTable
          table={table}
          pageSize={PAGE_SIZE}
          stickyHeader={false}
          itemName="result"
          totalCount={totalCount}
          emptyState={oneLineEmptyState('No work time entries for this period.')}
          footer={infiniteScroll}
          loadingCells={loading}
          layout={tableGrid.layout}
          settings={tableGrid.settings}
        />
      )}
    </>
  );
}

/** {@link WorkTimeTableView} with nothing read yet: what the Suspense fallback and the loading scope render. */
function WorkTimeTableViewPending({ showEmployee, showCustomer }: { showEmployee: boolean; showCustomer: boolean }) {
  return (
    <WorkTimeTableView
      showEmployee={showEmployee}
      showCustomer={showCustomer}
      stats={null}
      rows={NO_ITEMS}
      infiniteScroll={NO_NEXT_PAGE}
      onEdit={noop}
      onDelete={noop}
      employeeFilterOptions={NO_ITEMS}
      customerFilterOptions={NO_ITEMS}
      columnFilters={NO_ITEMS}
      onColumnFiltersChange={noop}
      richEmptyState={false}
    />
  );
}

export interface WorkTimeTableProps {
  /** Scope to one employee (employee details page). Raw user id — encoded to a global id internally. */
  employeeId?: string;
  /** Scope to one customer (customer details Worktime tab). Must be the org's Relay global id. */
  organizationGlobalId?: string;
  /** Show the Employee column (who logged the time). */
  showEmployee?: boolean;
  /** Show the Customer column (which organization the time is for). */
  showCustomer?: boolean;
  /**
   * Controlled "Add Work Time" modal — the trigger lives in the page/section header.
   * Omit both to render a display-only table without an add affordance.
   */
  addWorkTimeOpen?: boolean;
  onAddWorkTimeOpenChange?: (open: boolean) => void;
  /** Pre-select + lock this customer in the "Add Work Time" modal. Memoize to keep it stable. */
  addDefaultCustomer?: { id: string; label: string; imageUrl?: string };
}

/** The filters above the table: one frame, drawn by the loading form and the loaded one. */
const WORK_TIME_FRAME_CLASS = 'flex flex-col gap-[var(--spacing-system-l)]';

/**
 * The filters with nothing typed and the table in its loading state: what the component is in a loading scope,
 * where it reads nothing (no option lists, no entries).
 */
function WorkTimeTablePending({ showEmployee, showCustomer }: { showEmployee: boolean; showCustomer: boolean }) {
  return (
    <div className={WORK_TIME_FRAME_CLASS}>
      <WorkTimeFilters search="" onSearchChange={noop} range={undefined} onRangeChange={noop} />
      <WorkTimeTableViewPending showEmployee={showEmployee} showCustomer={showCustomer} />
    </div>
  );
}

/** The search box and the date range above the table. */
function WorkTimeFilters({
  search,
  onSearchChange,
  range,
  onRangeChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)] content-md:flex-row content-md:items-start">
      <Input
        userValue
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search for Work Time"
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
        className="w-full content-md:flex-1"
      />
      <DatePicker
        mode="range"
        value={range}
        onChange={onRangeChange}
        formatDate={formatDate}
        numberOfMonths={2}
        placeholder="Select dates"
        className="content-md:w-[276px]"
      />
    </div>
  );
}

/**
 * Stats + search/date filters + paginated time-entry table + edit/delete (and optional
 * add) modals. Shared by the employee details page (single employee), the tenant Worktime
 * page (all users, Employee + Customer columns), and the customer details Worktime tab
 * (one customer, Employee column). The header/title and the "Add Work Time" trigger are
 * owned by the caller; this owns the data and the modals. In a loading scope it draws its
 * own loading state and reads nothing.
 */
export function WorkTimeTable(props: WorkTimeTableProps) {
  const scoped = useLoadingScope();
  // While the table flag is read the table draws its loading state: it never draws one layout and swaps to the other.
  const flagLoading = useTableGridGate() === 'loading';
  if (scoped || flagLoading) {
    return (
      <LoadingWhen loading>
        <WorkTimeTablePending showEmployee={!!props.showEmployee} showCustomer={!!props.showCustomer} />
      </LoadingWhen>
    );
  }
  return <LiveWorkTimeTable {...props} />;
}

function LiveWorkTimeTable({
  employeeId,
  organizationGlobalId,
  showEmployee = false,
  showCustomer = false,
  addWorkTimeOpen,
  onAddWorkTimeOpenChange,
  addDefaultCustomer,
}: WorkTimeTableProps) {
  const { toast } = useToast();

  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    employeeIds: { type: 'array', default: [] },
    organizationIds: { type: 'array', default: [] },
    from: { type: 'string', default: '' },
    to: { type: 'string', default: '' },
  });
  const { search, setSearch, debouncedSearch } = useSearchParam(params.search, value => setParam('search', value), 300);

  const [range, setRangeState] = useState<DateRange | undefined>(() => rangeFromParams(params.from, params.to));
  const setRange = useCallback(
    (next: DateRange | undefined) => {
      setRangeState(next);
      setParams({ from: formatDayParam(next?.from), to: formatDayParam(next?.to) });
    },
    [setParams],
  );
  // Adopt an externally-changed range (back/forward, a shared link) during render:
  // the table below is keyed off `range`, so an effect would fetch and draw the
  // previous window once before correcting itself.
  const [lastParams, setLastParams] = useState({ from: params.from, to: params.to });
  if (params.from !== lastParams.from || params.to !== lastParams.to) {
    setLastParams({ from: params.from, to: params.to });
    if ((formatDayParam(range?.from) ?? '') !== params.from || (formatDayParam(range?.to) ?? '') !== params.to) {
      setRangeState(rangeFromParams(params.from, params.to));
    }
  }

  const [editTarget, setEditTarget] = useState<ManualEntryEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkTimeRow | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [deleteEntry, isDeleting] = useMutation<DeleteTimeEntryMutationType>(deleteTimeEntryMutation);

  const employeeFilterIds = params.employeeIds;
  const customerFilterIds = params.organizationIds;

  // The header filter has no search box: the filtered-by employees are asked for by id, so a selection past
  // the first page keeps its row.
  const { options: employeeOptionsRaw } = useAssigneeOptions({
    enabled: showEmployee,
    selectedIds: employeeFilterIds,
    pageSize: ASSIGNEE_FILTER_PAGE_SIZE,
  });
  const { options: customerOptionsRaw } = useOrganizationOptions('', showCustomer);

  const employeeFilterOptions = useMemo<DataTableFilterOption[]>(
    () => employeeOptionsRaw.map(option => ({ id: option.value, label: option.label, value: option.value })),
    [employeeOptionsRaw],
  );
  const customerFilterOptions = useMemo<DataTableFilterOption[]>(
    () => customerOptionsRaw.map(option => ({ id: option.value, label: option.label, value: option.value })),
    [customerOptionsRaw],
  );

  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(employeeFilterIds.length ? [{ id: 'employee', value: employeeFilterIds }] : []),
      ...(customerFilterIds.length ? [{ id: 'customer', value: customerFilterIds }] : []),
    ],
    [employeeFilterIds, customerFilterIds],
  );

  const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updater => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const byId = Object.fromEntries(next.map(entry => [entry.id, entry.value as string[]]));
      setParams({ employeeIds: byId.employee ?? [], organizationIds: byId.customer ?? [] });
    },
    [columnFilters, setParams],
  );

  // The rich empty state means "this workspace has logged no time at all", so it is
  // suppressed in the two scoped mountings (an employee's details, a customer's tab)
  // and whenever a search, date range or column filter is narrowing the list: an empty
  // result under a query is not an empty section, and it keeps the plain message that
  // says which period came back empty.
  const richEmptyState =
    !employeeId &&
    !organizationGlobalId &&
    !debouncedSearch &&
    !range?.from &&
    employeeFilterIds.length === 0 &&
    customerFilterIds.length === 0;

  const filter = useMemo<WorkTimeFilter>(() => {
    const dateRange = range?.from ? toInstantRange(range.from, range.to ?? range.from) : null;
    const employeeIds = employeeId
      ? [ensureGlobalIdForType('User', employeeId)]
      : employeeFilterIds.length
        ? employeeFilterIds.map(id => ensureGlobalIdForType('User', id))
        : null;
    const organizationIds = organizationGlobalId
      ? [organizationGlobalId]
      : customerFilterIds.length
        ? customerFilterIds.map(id => toOrganizationGlobalId(id)).filter((id): id is string => id != null)
        : null;
    return {
      employeeIds,
      organizationIds,
      startedFrom: dateRange?.startedFrom ?? null,
      startedTo: dateRange?.startedTo ?? null,
    };
  }, [employeeId, organizationGlobalId, employeeFilterIds, customerFilterIds, range]);

  const vars = useMemo<QueryVars>(
    () => ({ filter, search: debouncedSearch || null, first: PAGE_SIZE, after: null }),
    [filter, debouncedSearch],
  );

  const [fetchKey, setFetchKey] = useState(0);
  const refresh = useCallback(() => setFetchKey(key => key + 1), []);

  useEffect(
    () =>
      subscribeTimeEntriesChanged(changedUserId => {
        if (!employeeId || changedUserId === employeeId) refresh();
      }),
    [employeeId, refresh],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteEntry({
      variables: { id: deleteTarget.id },
      updater: makeDeleteTimeEntryUpdater(deleteTarget.id),
      onCompleted: () => {
        toast({ title: 'Time entry deleted', variant: 'success' });
        setDeleteTarget(null);
        refresh();
      },
      onError: err => {
        toast({ title: 'Failed to delete time entry', description: err.message, variant: 'destructive' });
      },
    });
  }, [deleteTarget, deleteEntry, refresh, toast]);

  return (
    <div className={WORK_TIME_FRAME_CLASS}>
      <WorkTimeFilters search={search} onSearchChange={setSearch} range={range} onRangeChange={setRange} />

      <ErrorBoundary
        key={retryNonce}
        fallback={
          <LoadError message="Couldn't load work time entries." onRetry={() => setRetryNonce(nonce => nonce + 1)} />
        }
      >
        <WorkTimeTableData
          showEmployee={showEmployee}
          showCustomer={showCustomer}
          vars={vars}
          fetchKey={fetchKey}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          employeeFilterOptions={employeeFilterOptions}
          customerFilterOptions={customerFilterOptions}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
          richEmptyState={richEmptyState}
        />
      </ErrorBoundary>

      {onAddWorkTimeOpenChange && (
        <ManualEntryModal
          isOpen={!!addWorkTimeOpen}
          onClose={() => onAddWorkTimeOpenChange(false)}
          userId={employeeId}
          selectableUser={!employeeId}
          defaultCustomer={addDefaultCustomer}
          onSuccess={refresh}
        />
      )}
      <ManualEntryModal
        isOpen={!!editTarget}
        entry={editTarget}
        userId={employeeId}
        selectableUser={!employeeId}
        onClose={() => setEditTarget(null)}
        onSuccess={refresh}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Entry"
        description={
          deleteTarget ? (
            <>
              <span className="text-ods-error">{formatDurationLabel(deleteTarget.durationSeconds)}</span> logged on{' '}
              <span className="text-ods-error">{formatDate(deleteTarget.startedAt)}</span> will be permanently removed
              and subtracted from totals.
            </>
          ) : null
        }
        confirmLabel="Delete Entry"
        variant="destructive"
        isPending={isDeleting}
        pendingLabel="Deleting..."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
