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
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DashboardInfoCard,
  type DataTableFilterOption,
  DatePicker,
  type DateRange,
  EntityImage,
  Input,
  LoadError,
  type OnChangeFn,
  SquareAvatar,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { format, isValid, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type { deleteTimeEntryMutation as DeleteTimeEntryMutationType } from '@/__generated__/deleteTimeEntryMutation.graphql';
import type { employeeWorkTimeRelay_query$key } from '@/__generated__/employeeWorkTimeRelay_query.graphql';
import type { employeeWorkTimeRelayPaginationQuery } from '@/__generated__/employeeWorkTimeRelayPaginationQuery.graphql';
import type { employeeWorkTimeRelayQuery as EmployeeWorkTimeRelayQueryType } from '@/__generated__/employeeWorkTimeRelayQuery.graphql';
import { customerContactEmail } from '@/app/(app)/customers/utils/customer-contact-email';
import { useAssigneeOptions, useOrganizationOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { type ManualEntryEditTarget, ManualEntryModal } from '@/app/components/manual-entry-modal';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { EmptyState } from '@/app/components/shared/empty-state';
import { useSearchParam } from '@/app/hooks/use-search-param';
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
import { LiveTable, loadingPlaceholderRows, emptyMessage } from '../live-table';
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

const employeeColumn: ColumnDef<WorkTimeRow> = {
  id: 'employee',
  header: 'EMPLOYEE',
  cell: ({ row }) => <EmployeeCell row={row.original} />,
  enableSorting: false,
  meta: { width: 'min-w-0 flex-1' },
};

const timeColumn: ColumnDef<WorkTimeRow> = {
  id: 'time',
  header: 'TIME',
  cell: ({ row }) => <TimeCell row={row.original} />,
  enableSorting: false,
  meta: { width: 'w-24 content-md:w-32 shrink-0 flex-none' },
};

const customerColumn: ColumnDef<WorkTimeRow> = {
  id: 'customer',
  header: 'CUSTOMER',
  cell: ({ row }) => <CustomerCell row={row.original} />,
  enableSorting: false,
  meta: { width: 'min-w-0 flex-1', hideAt: 'md' },
};

const ticketNotesColumn: ColumnDef<WorkTimeRow> = {
  id: 'ticketNotes',
  header: 'TICKET & NOTES',
  cell: ({ row }) => <TicketNotesCell row={row.original} />,
  enableSorting: false,
  meta: { width: 'min-w-0 flex-1', hideAt: 'md' },
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

function buildColumns(
  showEmployee: boolean,
  showCustomer: boolean,
  onEdit: (row: WorkTimeRow) => void,
  onDelete: (row: WorkTimeRow) => void,
  employeeFilterOptions: DataTableFilterOption[] = [],
  customerFilterOptions: DataTableFilterOption[] = [],
): ColumnDef<WorkTimeRow>[] {
  const actionsColumn: ColumnDef<WorkTimeRow> = {
    id: 'actions',
    header: '',
    cell: ({ row }) => <EntryActionsCell row={row.original} onEdit={onEdit} onDelete={onDelete} />,
    enableSorting: false,
    meta: { width: 'w-24 content-md:w-28 shrink-0 flex-none', align: 'right' },
  };

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
    actionsColumn,
  ];
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

/** The query container: reads the entries and the stats, and renders {@link WorkTimeTableView} with them. */
function WorkTimeTableData({ vars, fetchKey, ...viewProps }: WorkTimeTableDataProps) {
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
  const columns = useMemo(
    () => buildColumns(showEmployee, showCustomer, onEdit, onDelete, employeeFilterOptions, customerFilterOptions),
    [showEmployee, showCustomer, onEdit, onDelete, employeeFilterOptions, customerFilterOptions],
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
          emptyState={emptyMessage('No work time entries for this period.')}
          footer={infiniteScroll}
          loadingCells={loading}
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
  if (useLoadingScope()) {
    return <WorkTimeTablePending showEmployee={!!props.showEmployee} showCustomer={!!props.showCustomer} />;
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

  const { options: employeeOptionsRaw } = useAssigneeOptions(showEmployee);
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
        <LoadingSuspense
          label="Loading work time"
          fallback={<WorkTimeTableViewPending showEmployee={showEmployee} showCustomer={showCustomer} />}
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
        </LoadingSuspense>
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
