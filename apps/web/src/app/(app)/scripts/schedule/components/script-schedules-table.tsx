'use client';

import {
  OSTypeBadgeGroup,
  LoadingSuspense,
  TextLineSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components';
import {
  OpenInNewTabCell,
  RowActionsCell,
  SCHEDULE_COLUMNS,
  ScheduleDateTimeCell,
  ScheduleDateTimeGridCell,
  ScriptNameCell,
  ScriptNameGridCell,
  isDeviceLocalTime,
  isEventTrigger,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ArrowRightUpIcon,
  BoxArchiveIcon,
  Filter02Icon,
  HourglassClockIcon,
  InboxArrowUpIcon,
  LaptopIcon,
  ListBulletIcon,
  PenEditIcon,
  PlusCircleIcon,
  RadarIcon,
  SearchIcon,
  TimerIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  type DataTableSortState,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  Input,
  LoadingWhen,
  PageLayout,
  type Row,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
  useToast,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchQuery, graphql, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type { scriptScheduleFiltersRefreshRelayQuery as ScheduleFiltersRefreshQueryType } from '@/__generated__/scriptScheduleFiltersRefreshRelayQuery.graphql';
import type {
  scriptSchedulesTableQuery as SchedulesTableQueryType,
  ScriptScheduleFilterInput,
  SortInput,
} from '@/__generated__/scriptSchedulesTableQuery.graphql';
import { useGenerateWithAiAction } from '@/app/(app)/mingo/hooks/use-generate-with-ai-action';
import { useMingoCreatedEpoch } from '@/app/(app)/mingo/stores/mingo-created-entities-store';
import { DIALOG_INTENT } from '@/app/(app)/tickets/constants';
import {
  EmptyState,
  onboardingGuideButton,
  oneLineEmptyState,
  type TableDateFilter,
  useRetryKey,
} from '@/app/components/shared';
import { dateColumnHeader } from '@/app/components/shared/date-column-header';
import { LiveTable } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { ValueText } from '@/app/components/shared/value-text';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { ScriptStatus } from '@/generated/schema-enums';
import { scriptScheduleFiltersRefreshRelayQuery } from '@/graphql/scripts/script-schedule-filters-refresh-relay';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useListRefreshEpoch } from '@/lib/list-refresh';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { type FacetOption, facetFilter, facetToMappedOptions, readFacet } from '../../shared/utils/facet-options';
import { SCRIPTS_TABLE_SETTINGS, scriptsLiveColumnMeta, scriptsLiveColumnSize } from '../../shared/utils/grid-columns';
import { platformsToEnums, platformsToIds } from '../../shared/utils/script-mappers';
import { useScheduleArchiveMutations } from '../hooks/use-schedule-archive';
import { DEVICE_LOCAL_TIME_NOTE, formatScheduleStartAt, repeatToLabel } from '../utils/schedule-timing';
import { ArchiveScheduleModal } from './archive-schedule-modal';
import { RestoreScheduleModal } from './restore-schedule-modal';

const PAGE_SIZE = 20;

/**
 * One page of schedules per request, its cursor in the URL (`cursor`; no `@connection`: a cursor from a link must read
 * exactly its page). The list pages back on the server (`last` / `before` return the page before the cursor), so the
 * query takes all four page arguments; the pager sets the pair it uses and leaves the other null.
 *
 * `scriptScheduleFilters` (the filter facets) rides the same operation, so each filter interaction is a single
 * round-trip and the dropdown options update with the rows; a page move asks for them again with the same scope (the
 * same answer). Only the platforms facet is read (the table has no author column); `authors` stays unselected until a
 * column needs it.
 */
const scriptSchedulesTableQuery = graphql`
  query scriptSchedulesTableQuery(
    $filter: ScriptScheduleFilterInput
    $search: String
    $sort: SortInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    scriptSchedules(
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      filteredCount
      edges {
        node {
          id
          name
          description
          supportedPlatforms
          deviceCount
          trigger
          # Which clock startAt is in — SERVER (an absolute instant) or
          # DEVICE_LOCAL (a wall clock re-based per device). The Date & Time
          # column reads it to decide whether to convert through the viewer's
          # offset.
          timeReference
          startAt
          repeat
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
    scriptScheduleFilters(filter: $filter) {
      platforms {
        ...facetOptions_entry
      }
    }
  }
`;

/**
 * The only values allowed to reach `SortInput.field` — everything else in the
 * URL falls back to the backend's own order.
 *
 * `repeat` is the REPEAT header's own toggle (id = backend field). `startAt` has
 * no header toggle: it is the direction inside the DATE & TIME calendar, which
 * writes the same `sortBy`/`sortDir` params so the two controls can't claim
 * conflicting orders at once. `scriptSchedules(sort:)` also accepts `name` and
 * `deviceCount`, which no control offers, so they stay unaccepted from the URL.
 */
const SORTABLE_COLUMN_IDS = ['repeat', 'startAt'] as const;

/** Backend sort field behind the DATE & TIME calendar (`ScriptSchedule.startAt`). */
const START_AT_SORT_FIELD = 'startAt';

/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's, so importing it here would be an undeclared one.
 */
type ColumnFilterState = { id: string; value: unknown }[];

interface UiScheduleEntry {
  id: string;
  name: string;
  description: string;
  supportedPlatforms: string[];
  deviceCount: number;
  /** `DEVICE_ONLINE` schedules have no startAt/repeat at all — see `isEventTrigger`. */
  trigger: string;
  startAt: string | null;
  /** Which clock `startAt` is in — the Date & Time cell converts only a SERVER one. */
  timeReference: string;
  repeat: number | null;
}

/**
 * When a schedule starts: the date over the time, or beside it in the grid layout (`grid`: one line). A row still
 * being read draws the date and time as bars (most schedules have a start).
 */
function ScheduleStartCell({ schedule, grid = false }: { schedule: UiScheduleEntry; grid?: boolean }) {
  const DateTime = grid ? ScheduleDateTimeGridCell : ScheduleDateTimeCell;
  if (useLoadingScope()) return <DateTime date="" time="" />;
  // Event-driven schedules have no date/time — name the trigger instead
  // of showing an em dash that reads as "not configured yet".
  if (isEventTrigger(schedule.trigger)) {
    return grid ? (
      <TruncateText as="span" variant="h4" tone="secondary">
        Device Online
      </TruncateText>
    ) : (
      <TruncateText tone="secondary">Device Online</TruncateText>
    );
  }
  if (!schedule.startAt) {
    return <ValueText value={null} />;
  }
  const { date, time } = formatScheduleStartAt(schedule.startAt, schedule.timeReference);
  // The reading rides the time, not a column of its own: a device-local
  // row shows the wall clock each device reads on its own timezone, and
  // an unmarked "6:00 PM" here reads as the viewer's.
  return (
    <DateTime
      date={date}
      time={isDeviceLocalTime(schedule.timeReference) ? `${time} · ${DEVICE_LOCAL_TIME_NOTE.toLowerCase()}` : time}
    />
  );
}

/** How often a schedule repeats; a bar while the row is read. */
function ScheduleRepeatCell({ schedule }: { schedule: UiScheduleEntry }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h4" className="w-20" />;
  if (isEventTrigger(schedule.trigger)) return <ValueText value={null} />;
  return <span className="text-ods-text-primary text-h4">{repeatToLabel(schedule.repeat)}</span>;
}

/** How many devices a schedule targets; a bar while the row is read. */
function ScheduleDeviceCountCell({ schedule }: { schedule: UiScheduleEntry }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h4" className="w-8" />;
  return <span className="text-ods-text-primary text-h4">{schedule.deviceCount}</span>;
}

/**
 * The table's columns: the loaded table and its loading state draw the same ones. With no `options` (loading) the OS
 * funnel is pending.
 */
function scheduleColumns({
  options,
  dateFilter,
  renderRowActions,
  layout,
}: {
  options: { platform: FacetOption[] } | null;
  /** The Date/Time header's calendar; absent while loading (the header draws inert). */
  dateFilter?: TableDateFilter;
  renderRowActions: (schedule: UiScheduleEntry) => ReactNode;
  /** The table's layout: which of the two date headers the Date/Time column gets. Default: card rows. */
  layout?: TableLayout;
}): ColumnDef<UiScheduleEntry>[] {
  // The Date/Time cell IS `startAt`, the field the calendar filters and orders by, so the date menu sits on its header
  // rather than on a column of its own.
  const date = dateColumnHeader(SCHEDULE_COLUMNS.dateTime.header, dateFilter, layout);
  return [
    {
      accessorKey: 'name',
      header: SCHEDULE_COLUMNS.name.header,
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
        <ScriptNameCell name={row.original.name} description={row.original.description} />
      ),
      enableSorting: false,
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.name),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.name, {
        gridCell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <ScriptNameGridCell name={row.original.name} description={row.original.description} />
        ),
      }),
    },
    {
      accessorKey: 'supportedPlatforms',
      header: SCHEDULE_COLUMNS.supportedPlatforms.header,
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
        <OSTypeBadgeGroup osTypes={row.original.supportedPlatforms} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      ),
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.supportedPlatforms),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.supportedPlatforms, {
        filter: facetFilter(options?.platform),
        gridCell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <OSTypeBadgeGroup osTypes={row.original.supportedPlatforms} iconSize="w-5 h-5" className="flex-nowrap" />
        ),
      }),
    },
    {
      id: 'dateTime',
      header: date.header,
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => <ScheduleStartCell schedule={row.original} />,
      enableSorting: false,
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.dateTime),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.dateTime, {
        dateFilter: date.dateFilter,
        gridCell: ({ row }: { row: Row<UiScheduleEntry> }) => <ScheduleStartCell schedule={row.original} grid />,
      }),
    },
    {
      id: 'repeat',
      header: SCHEDULE_COLUMNS.repeat.header,
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => <ScheduleRepeatCell schedule={row.original} />,
      enableSorting: false,
      // One line already: the grid draws the same cell.
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.repeat),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.repeat),
    },
    {
      accessorKey: 'deviceCount',
      header: SCHEDULE_COLUMNS.deviceCount.header,
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => <ScheduleDeviceCountCell schedule={row.original} />,
      enableSorting: false,
      // One line already: the grid draws the same cell.
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.deviceCount),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.deviceCount),
    },
    {
      id: 'actions',
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
        <RowActionsCell>{renderRowActions(row.original)}</RowActionsCell>
      ),
      enableSorting: false,
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.actions),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.actions),
    },
    {
      id: 'open',
      cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
        <OpenInNewTabCell href={routes.scripts.schedules.details(row.original.id)} />
      ),
      enableSorting: false,
      ...scriptsLiveColumnSize(SCHEDULE_COLUMNS.open),
      meta: scriptsLiveColumnMeta(SCHEDULE_COLUMNS.open, {
        gridCell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <OpenInNewTabCell href={routes.scripts.schedules.details(row.original.id)} grid />
        ),
      }),
    },
  ];
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface SchedulesTableContentProps {
  backendFilters: ScriptScheduleFilterInput;
  debouncedSearch: string;
  /** Deferred sort — feeds the query (lags the live indicator during a refetch). */
  sort: SortInput | null;
  tableFilters: Record<string, string[]>;
  /** Live sort — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /**
   * True while the deferred query variables lag the live filter/search/page state
   * (a refetch is in flight and the rows on screen are the previous result) —
   * guards the empty state so it never flashes on stale data, and holds the pager.
   */
  isPending: boolean;
  onFilterChange: (filters: Record<string, string[]>) => void;
  /** First-run date sort + range, hosted by the DATE & TIME column header. */
  dateFilter: TableDateFilter;
  onEmptyChange: (isEmpty: boolean) => void;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
  archived: boolean;
  /** The table's layout, from the app's one table flag: read once by the page and handed to every form of the list. */
  tableLayout: TableLayout;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

function SchedulesTableContent({
  backendFilters,
  debouncedSearch,
  sort,
  tableFilters,
  sortState,
  onSortChange,
  isPending,
  onFilterChange,
  dateFilter,
  onEmptyChange,
  mobileFilterOpen,
  onMobileFilterClose,
  stickyHeaderOffset,
  archived,
  tableLayout,
  pager,
  pageVariables,
}: SchedulesTableContentProps) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();

  const { setArchived, isArchiving, isUnarchiving } = useScheduleArchiveMutations();

  // Schedule whose archive/restore is awaiting confirmation in the modal (null = closed).
  const [confirmTarget, setConfirmTarget] = useState<UiScheduleEntry | null>(null);

  // One page per request, its cursor in the URL; the list pages back on the server. The filter facets
  // (`scriptScheduleFilters`) ride the same operation — see the query docstring.
  const retryKey = useRetryKey();
  // Mingo can add a row from the chat; its create refetches the list.
  const mingoCreated = useMingoCreatedEpoch('scriptSchedule');
  // An archive or unarchive (here or on the schedule's page) marks the list changed: the page is read again.
  const changed = useListRefreshEpoch('scriptSchedules');
  const variables = { filter: backendFilters, search: debouncedSearch || null, sort, ...pageVariables };
  const queryData = useLazyLoadQuery<SchedulesTableQueryType>(scriptSchedulesTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${mingoCreated}:${changed}`,
  });
  const refetch = useRefetchPage<SchedulesTableQueryType>(scriptSchedulesTableQuery, variables);
  const { edges, pageInfo, filteredCount } = queryData.scriptSchedules;
  // A top-level page: its auto-refresh interval has no prefix, as its other params.
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, refetch, isPending });

  const transformedSchedules: UiScheduleEntry[] = useMemo(
    () =>
      edges.map(({ node }) => ({
        id: node.id,
        name: node.name,
        description: node.description ?? '',
        supportedPlatforms: platformsToIds(node.supportedPlatforms),
        deviceCount: node.deviceCount,
        trigger: node.trigger,
        startAt: node.startAt ?? null,
        timeReference: node.timeReference,
        repeat: node.repeat ?? null,
      })),
    [edges],
  );

  // Server-driven platform facet, mapped from the backend enum to the UI id the
  // column filter + `backendFilters` use (windows / darwin / linux).
  const platformOptions = useMemo(
    () =>
      facetToMappedOptions(readFacet(queryData.scriptScheduleFilters?.platforms), value => platformsToIds([value])[0]),
    [queryData.scriptScheduleFilters?.platforms],
  );

  const renderRowActions = useCallback(
    (schedule: UiScheduleEntry) => {
      const editHref = routes.scripts.schedules.edit(schedule.id);
      const devicesHref = routes.scripts.schedules.devices(schedule.id);
      const newTabIcon = <ArrowRightUpIcon className="h-5 w-5 text-ods-text-secondary" />;
      const mutating = isArchiving || isUnarchiving;

      // An archived schedule has exactly one thing that can be done to it, so it
      // gets a button rather than a menu — editing belongs to schedules that still
      // run, and a dropdown holding a single item is a click of pure ceremony.
      if (archived) {
        return (
          <Button
            onClick={() => setConfirmTarget(schedule)}
            variant="outline"
            size="icon"
            leftIcon={<InboxArrowUpIcon className="h-5 w-5" />}
            aria-label="Unarchive Schedule"
            disabled={mutating}
            className="bg-ods-card"
          />
        );
      }

      // Opens the confirmation modal only; the mutation runs on confirm.
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'edit-schedule',
              label: 'Edit Schedule',
              icon: <PenEditIcon className="h-6 w-6 text-ods-text-secondary" />,
              href: editHref,
              iconAction: {
                icon: newTabIcon,
                'aria-label': 'Open Edit Schedule in new tab',
                href: editHref,
                openInNewTab: true,
              },
            },
            {
              id: 'edit-devices',
              label: 'Edit Devices',
              icon: <LaptopIcon className="h-6 w-6 text-ods-text-secondary" />,
              href: devicesHref,
              iconAction: {
                icon: newTabIcon,
                'aria-label': 'Open Edit Devices in new tab',
                href: devicesHref,
                openInNewTab: true,
              },
            },
            {
              id: 'archive-schedule',
              label: 'Archive Schedule',
              icon: <BoxArchiveIcon className="h-6 w-6 text-ods-text-secondary" />,
              disabled: mutating,
              onClick: () => setConfirmTarget(schedule),
            },
          ],
        },
      ];

      return <ActionsMenuDropdown groups={groups} />;
    },
    [archived, isArchiving, isUnarchiving],
  );

  // Archiving/unarchiving changes the list's MEMBERSHIP, so the platform facet
  // may still offer values whose last schedule just left this scope. Re-fetch it
  // imperatively into the store (`fetchQuery(...).subscribe({})`).
  const refreshFilterMeta = useCallback(() => {
    fetchQuery<ScheduleFiltersRefreshQueryType>(
      environment,
      scriptScheduleFiltersRefreshRelayQuery,
      { filter: backendFilters },
      { fetchPolicy: 'network-only' },
    ).subscribe({});
  }, [environment, backendFilters]);

  // Runs the archive/unarchive for the schedule the confirm modal targets. On
  // success the hook marks the list changed, so this page is read again from the
  // server. The `updater` invalidates the record, so every other cache still
  // holding it is marked stale and refetches on its next read — mirrors the
  // scripts table's archive flow.
  const handleConfirmArchive = useCallback(() => {
    if (!confirmTarget) return;
    const { id, name } = confirmTarget;
    const updater = (store: RecordSourceSelectorProxy) => store.get(id)?.invalidateRecord();
    setArchived(id, !archived, {
      updater,
      onCompleted: () => {
        toast(
          archived
            ? {
                title: 'Schedule unarchived',
                description: `"${name}" was moved back to Scripts Schedules.`,
                variant: 'success',
              }
            : {
                title: 'Schedule archived',
                description: `"${name}" was moved to Archived Schedules.`,
                variant: 'success',
              },
        );
        setConfirmTarget(null);
        refreshFilterMeta();
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, `Failed to ${archived ? 'unarchive' : 'archive'} schedule`),
          variant: 'destructive',
        });
        setConfirmTarget(null);
      },
    });
  }, [confirmTarget, archived, setArchived, toast, refreshFilterMeta]);

  const columns = useMemo<ColumnDef<UiScheduleEntry>[]>(
    () =>
      scheduleColumns({ options: { platform: platformOptions }, dateFilter, renderRowActions, layout: tableLayout }),
    [renderRowActions, platformOptions, dateFilter, tableLayout],
  );

  const filterGroups = useMemo(
    () => [{ id: 'supportedPlatforms', title: 'OS', options: platformOptions }],
    [platformOptions],
  );

  const columnFilters = useMemo(
    () =>
      Object.entries(tableFilters)
        .filter(([, value]) => value && value.length > 0)
        .map(([id, value]) => ({ id, value })),
    [tableFilters],
  );

  const handleColumnFiltersChange = useCallback(
    // TanStack's updater signature: either the next state or a reducer over it.
    (updater: ColumnFilterState | ((prev: ColumnFilterState) => ColumnFilterState)) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const nextFilters: Record<string, string[]> = {};
      for (const f of next) {
        nextFilters[f.id] = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value)];
      }
      onFilterChange(nextFilters);
    },
    [columnFilters, onFilterChange],
  );

  const table = useDataTable<UiScheduleEntry>({
    data: transformedSchedules,
    columns,
    getRowId: (row: UiScheduleEntry) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  const scheduleRowHref = useCallback((schedule: UiScheduleEntry) => routes.scripts.schedules.details(schedule.id), []);

  // The date range narrows the list exactly like the OS funnel does, so it
  // counts as an active filter: an empty result then reads as "nothing matched"
  // instead of "no schedules yet" — and the placeholder, which replaces the
  // whole table, would take the calendar down with it and strand the user.
  const hasActiveFilters = Object.values(tableFilters).some(values => values.length > 0) || Boolean(dateFilter.range);
  // An empty LATER page (a cursor about to be dropped) keeps the table and its pager, so First stays reachable.
  const showEmptyState =
    !debouncedSearch && !hasActiveFilters && !isPending && pager.isFirstPage && transformedSchedules.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  const guideButton = onboardingGuideButton('script-schedules');

  if (showEmptyState && archived) {
    return (
      <EmptyState
        icon={<BoxArchiveIcon />}
        title="No archived schedules"
        description="Schedules you archive will be moved here. They stay out of the main list but can be restored any time."
      />
    );
  }

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<TimerIcon />}
        title="No scripts schedules yet"
        description="Scripts set to run automatically on a schedule (daily maintenance, weekly cleanups, monthly audits) will be displayed here."
        actions={[
          { icon: <HourglassClockIcon />, label: 'Run hourly, daily, weekly, or on custom cron' },
          { icon: <RadarIcon />, label: 'Target specific devices, Customers, or tags' },
          { icon: <ListBulletIcon />, label: 'View execution history and success rates' },
        ]}
        {...guideButton}
      />
    );
  }

  return (
    <>
      <LiveTable
        isPending={isPending}
        table={table}
        pageSize={PAGE_SIZE}
        totalCount={filteredCount}
        stickyHeaderOffset={stickyHeaderOffset}
        {...gridTableProps(tableLayout)}
        sort={sortState}
        onSortChange={onSortChange}
        emptyState={oneLineEmptyState(
          debouncedSearch
            ? `No schedules found matching "${debouncedSearch}". Try adjusting your search.`
            : 'No schedules found. Try adjusting your filters or add a new schedule.',
        )}
        rowHref={scheduleRowHref}
        pager={paged.pager}
        refresh={paged.refresh}
      />

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={tableFilters}
        // DATE & TIME is a `hideAt: 'md'` column, so below that breakpoint its
        // header calendar isn't on screen at all — this modal is where the same
        // sort + range lives, drafted alongside the OS funnel.
        dateFilter={{
          title: 'Date & Time',
          sort: dateFilter.sortDirection,
          range: dateFilter.range,
          onChange: dateFilter.onApply,
        }}
      />

      {archived ? (
        <RestoreScheduleModal
          open={confirmTarget !== null}
          onOpenChange={open => !open && setConfirmTarget(null)}
          onConfirm={handleConfirmArchive}
          isPending={isUnarchiving}
        />
      ) : (
        <ArchiveScheduleModal
          open={confirmTarget !== null}
          onOpenChange={open => !open && setConfirmTarget(null)}
          onConfirm={handleConfirmArchive}
          isPending={isArchiving}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------
// The table before its first answer
// ----------------------------------------------------------------

/** The columns before the first answer: the OS funnel pending, the calendar inert, no row to act on. */
const LOADING_COLUMNS = scheduleColumns({ options: null, renderRowActions: () => null });

/**
 * The table's layout props, the same for the loaded table and its loading form. In the grid layout the table is the
 * page's scroll area (it fills the height under the toolbar) and keeps the viewer's column layout under the list's
 * key; `LiveTable` passes neither on while the table draws card rows.
 */
function gridTableProps(tableLayout: TableLayout) {
  return { layout: tableLayout, maxHeight: 'fill', settings: SCRIPTS_TABLE_SETTINGS.schedules } as const;
}

/**
 * The schedules list, with its own boundary: in its scope the reader draws the table's loading form. A cursor the
 * server refuses drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
function SchedulesTable(props: SchedulesTableContentProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <SchedulesTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function SchedulesTableLoading(props: SchedulesTableContentProps) {
  return (
    <LoadingSuspense label="Loading schedules">
      <SchedulesTableReader {...props} />
    </LoadingSuspense>
  );
}

function SchedulesTableReader(props: SchedulesTableContentProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no
  // read; the pager is drawn, waiting.
  if (useLoadingScope())
    return (
      <LiveTable
        columns={LOADING_COLUMNS}
        pageSize={PAGE_SIZE}
        stickyHeaderOffset={props.stickyHeaderOffset}
        {...gridTableProps(props.tableLayout)}
        pager={null}
      />
    );
  return <SchedulesTableContent {...props} />;
}

// ----------------------------------------------------------------
// Outer shell — layout + URL state
// ----------------------------------------------------------------

interface ScriptSchedulesTableProps {
  /** When true, lists archived schedules (status = ARCHIVED) with a back button instead of the header actions. */
  archived?: boolean;
}

export function ScriptSchedulesTable({ archived = false }: ScriptSchedulesTableProps = {}) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.scripts.schedules.list);

  // A top-level page, so no prefix. A change to the search, the funnel, the sort or the calendar drops the pager's
  // cursor in the SAME URL write (one history entry on page 2+, so Back returns to the old view).
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      supportedPlatforms: { type: 'array', default: [] },
      // Server-side sort: backend sort field ('repeat' from the REPEAT header,
      // 'startAt' from the DATE & TIME calendar) + direction. Empty sortBy =
      // backend default order (newest-first by _id).
      sortBy: { type: 'string', default: '' },
      sortDir: { type: 'string', default: 'desc' },
      // First-run date range (local `yyyy-MM-dd`, inclusive) — the DATE & TIME
      // calendar. Sent as `startAtFrom` / `startAtTo`.
      dateFrom: { type: 'string', default: '' },
      dateTo: { type: 'string', default: '' },
    },
    { resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    pageSize: PAGE_SIZE,
    ...PAGED_LISTS.scriptSchedules,
    resetOn: JSON.stringify(params),
  });

  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    300,
  );

  const [isEmpty, setIsEmpty] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  // The new grid table, behind the app's one table flag; card rows while it is off.
  const tableGate = useTableGridGate();

  // Applied first-run range, restored from the URL.
  const dateRange: DateRange | undefined = useMemo(
    () => dateRangeFromParams(params.dateFrom, params.dateTo),
    [params.dateFrom, params.dateTo],
  );

  const backendFilters: ScriptScheduleFilterInput = useMemo(() => {
    const supportedPlatforms = platformsToEnums(params.supportedPlatforms);
    // The picked days become inclusive UTC instants (local `00:00` → `23:59:59`),
    // so a day picked in the calendar is that whole day on the server.
    const bounds = dateRangeToInstantBounds(dateRange);
    // Default scriptSchedules() (null statuses) returns ACTIVE + ARCHIVED
    // together; scope each page explicitly so the archive lives on its own list.
    return {
      statuses: [archived ? ScriptStatus.ARCHIVED : ScriptStatus.ACTIVE],
      ...(supportedPlatforms.length > 0 && { supportedPlatforms }),
      ...(bounds.from && { startAtFrom: bounds.from }),
      ...(bounds.to && { startAtTo: bounds.to }),
    };
  }, [archived, params.supportedPlatforms, dateRange]);

  // `sortBy` arrives from the URL, so it is user input: a hand-edited or stale
  // link (`?sortBy=deviceCount` from before DEVICES lost its toggle) would
  // otherwise travel straight into `SortInput.field` and surface as a GraphQL
  // error inside the Suspense boundary, with no way back from the page itself.
  // Anything outside SORTABLE_COLUMN_IDS falls back to the backend's own order.
  const sortBy = (SORTABLE_COLUMN_IDS as readonly string[]).includes(params.sortBy) ? params.sortBy : '';

  // Backend SortInput for the query; null = no sort (backend default order).
  const sortInput = useMemo<SortInput | null>(
    () => (sortBy ? { field: sortBy, direction: params.sortDir === 'asc' ? 'ASC' : 'DESC' } : null),
    [sortBy, params.sortDir],
  );

  // Live descriptor the header renders its indicator from (flips instantly on
  // click). Only for the COLUMN toggles: `startAt` is the calendar's direction
  // and no column carries that id, so handing it over would have the header
  // hunting for a column that isn't there.
  const sortState = useMemo<DataTableSortState | null>(
    () => (sortBy && sortBy !== START_AT_SORT_FIELD ? { id: sortBy, desc: params.sortDir !== 'asc' } : null),
    [sortBy, params.sortDir],
  );

  // The calendar shows a direction only while it OWNS the sort; a list ordered
  // by REPEAT leaves it on its default rather than claiming that order too.
  const dateSortDirection: 'asc' | 'desc' = sortBy === START_AT_SORT_FIELD && params.sortDir === 'asc' ? 'asc' : 'desc';

  // The mobile FilterModal commits the funnels and the date section as two
  // callbacks in the same tick; the shared writer merges them into a single URL
  // write (sequential setParams calls each re-read the stale URL and clobber, so
  // the platform selection would be lost whenever a date is applied beside it).
  const queueParamsWrite = useQueuedParamsWrite(setParams);

  // Apply, and Reset (which fires with the selection cleared).
  const handleDateFilterApply = useCallback(
    (result: DateFilterResult) => {
      const dateFrom = result.range?.from ? toDayParam(result.range.from) : '';
      const dateTo = result.range?.to ? toDayParam(result.range.to) : '';
      // The calendar takes the sort when it has something to order by — a range,
      // or an explicit oldest-first. Cleared back to its defaults it gives the
      // sort up again, so Reset returns the list (and the URL) to the backend
      // order — but only if the calendar is what took it: a list sorted by
      // REPEAT keeps its own sort through all of this.
      const ownsSort = result.sort === 'asc' || Boolean(dateFrom || dateTo);
      const leavesOtherSortAlone = !ownsSort && sortBy !== START_AT_SORT_FIELD;
      queueParamsWrite({
        ...(leavesOtherSortAlone
          ? {}
          : // `sortDir: ''` — NOT `'desc'` — for the default direction, per the
            // note on `handleSortChange` below.
            { sortBy: ownsSort ? START_AT_SORT_FIELD : '', sortDir: result.sort === 'desc' ? '' : result.sort }),
        dateFrom,
        dateTo,
      });
    },
    [queueParamsWrite, sortBy],
  );

  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection: dateSortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [dateSortDirection, dateRange, handleDateFilterApply],
  );

  // Filter + sort travel together as one deferred object so the query lags in
  // lockstep and `isPending` covers both; the LIVE params keep driving the
  // controls (checkboxes, header indicator) so they respond instantly. The query
  // reads the search from the URL, not the box's debounced value: the URL write
  // that carries a new search drops the cursor in the same navigation, so the two
  // never meet in one request. The page is deferred with the rest, so a page move
  // keeps the current rows on screen (dimmed) while the next ones are read.
  const queryVars = useMemo(() => ({ filter: backendFilters, sort: sortInput }), [backendFilters, sortInput]);
  const {
    deferredFilters: deferredVars,
    deferredSearch,
    deferredPage,
    isPending,
  } = useDeferredQuery(queryVars, params.search, pager.variables);

  const tableFilters = useMemo(() => ({ supportedPlatforms: params.supportedPlatforms }), [params.supportedPlatforms]);

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      queueParamsWrite({ supportedPlatforms: columnFilters.supportedPlatforms || [] });
    },
    [queueParamsWrite],
  );

  // 3-state toggle owned by the consumer (per DataTable.Header contract):
  // unsorted → desc → asc → unsorted. `columnId` is the column's id, which
  // equals the backend sort field ('repeat').
  //
  // `sortDir: ''` — NOT `'desc'` — whenever the direction is the default one:
  // `useApiParams` drops a param from the URL only when the value is empty, it
  // never compares against the schema default. Writing `'desc'` would leave a
  // stale `?sortDir=desc` behind on an unsorted list. Reading it back still
  // yields `'desc'` (the schema default), so the state is identical.
  // Cycles against the CLAMPED value, so a bogus `?sortBy` in the URL behaves
  // like no sort at all rather than as an invisible first state to click past.
  const handleSortChange = useCallback(
    (columnId: string) => {
      if (sortBy !== columnId) {
        setParams({ sortBy: columnId, sortDir: '' });
      } else if (params.sortDir === 'desc') {
        setParams({ sortDir: 'asc' });
      } else {
        setParams({ sortBy: '', sortDir: '' });
      }
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [sortBy, params.sortDir, setParams],
  );

  const handleOpenArchive = useCallback(() => {
    router.push(routes.scripts.schedules.archived);
  }, [router]);

  const handleNewSchedule = useCallback(() => {
    router.push(routes.scripts.schedules.new);
  }, [router]);

  // Archived list has no header actions (back button only); the active list
  // shows Archive (→ archived page) + Add Schedule.
  const generateWithAi = useGenerateWithAiAction(DIALOG_INTENT.CREATE_SCRIPT_SCHEDULE);
  const actions = useMemo(
    () =>
      archived
        ? []
        : [
            {
              label: 'Archive',
              variant: 'outline' as const,
              icon: <BoxArchiveIcon className="h-6 w-6 text-ods-text-secondary" />,
              onClick: handleOpenArchive,
            },
            {
              label: 'Add Schedule',
              variant: (isEmpty ? 'accent' : 'outline') as 'accent' | 'outline',
              icon: (
                <PlusCircleIcon size={24} className={isEmpty ? 'text-ods-text-on-accent' : 'text-ods-text-secondary'} />
              ),
              onClick: handleNewSchedule,
              iconAction: generateWithAi,
            },
          ],
    [archived, handleOpenArchive, handleNewSchedule, isEmpty, generateWithAi],
  );

  const mobileFilterButton = (
    <Button
      variant="outline"
      size="icon"
      className="content-md:hidden"
      onClick={() => setMobileFilterOpen(true)}
      aria-label="Open filters"
      leftIcon={<Filter02Icon className="text-ods-text-primary" />}
    />
  );

  return (
    <PageLayout
      title={archived ? 'Archived Schedules' : 'Scripts Schedules'}
      backButton={archived ? { label: 'Back', onClick: handleBack } : undefined}
      actions={actions.length > 0 ? actions : undefined}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              userValue
              placeholder="Search for Schedule"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1"
              startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
            />
            {mobileFilterButton}
          </div>
        )}

        {/* Until the flag answers the list is its loading form: a guess would draw one table and replace it. */}
        <LoadingWhen loading={tableGate === 'loading'}>
          <SchedulesTable
            backendFilters={deferredVars.filter}
            debouncedSearch={deferredSearch}
            sort={deferredVars.sort}
            tableFilters={tableFilters}
            sortState={sortState}
            onSortChange={handleSortChange}
            isPending={isPending}
            onFilterChange={handleFilterChange}
            dateFilter={dateFilter}
            onEmptyChange={setIsEmpty}
            mobileFilterOpen={mobileFilterOpen}
            onMobileFilterClose={() => setMobileFilterOpen(false)}
            stickyHeaderOffset={stickyHeaderOffset}
            archived={archived}
            tableLayout={tableLayoutFor(tableGate)}
            pager={pager}
            pageVariables={deferredPage}
          />
        </LoadingWhen>
      </div>
    </PageLayout>
  );
}
