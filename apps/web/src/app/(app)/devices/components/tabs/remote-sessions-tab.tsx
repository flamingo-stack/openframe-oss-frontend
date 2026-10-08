'use client';

import { ComputerMouseIcon, Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  SearchInput,
  type SortDirection,
  type SortingState,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import type { TableDateFilter } from '@/app/components/shared/date-column-header';
import { useNow } from '@/app/hooks/use-now';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { dateRangeToInstantBounds } from '@/lib/date-filter-params';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { useDeleteSessionRecording, useSessionRecordings } from '../../hooks/use-session-recordings';
import type { Device } from '../../types/device.types';
import type { RecordingSummary } from '../../types/session-recording';
import { remoteSessionColumns } from '../remote-sessions/remote-session-columns';
import { canOpenSession, EXPIRES_FILTER_OPTIONS } from '../remote-sessions/session-status';
import { REMOTE_SESSION_COLUMNS } from './device-tab-columns';
import { TabEmptyState } from './tab-empty-state';

interface RemoteSessionsTabProps {
  device: Device | null;
}

const EMPTY_RECORDINGS: RecordingSummary[] = [];
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = [];

/** Newest session first, like every history list on the device page. */
const DEFAULT_SORTING: SortingState = [{ id: REMOTE_SESSION_COLUMNS.session.id, desc: true }];

/** The page a row opens: the session's recording, when it has one to play. */
function recordingHref(row: RecordingSummary): string | null {
  return row.recordingId && canOpenSession(row) ? routes.devices.remoteSessionRecording(row.recordingId) : null;
}

/** The column funnels the mobile FilterModal mirrors. */
const MODAL_FILTER_IDS = [REMOTE_SESSION_COLUMNS.employee.id, REMOTE_SESSION_COLUMNS.expires.id];

/** Remote sessions of this device, one row per session, each opening the recording it produced. */
export function RemoteSessionsTab({ device }: RemoteSessionsTabProps) {
  const router = useRouter();
  const deviceId = device?.machineId ?? null;
  const { data, isLoading } = useSessionRecordings(deviceId);
  const deleteRecording = useDeleteSessionRecording(deviceId ?? '');
  // The "Expires in N hours" countdown keeps moving while the tab is open.
  const now = useNow(60_000);

  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(EMPTY_COLUMN_FILTERS);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [deleteTarget, setDeleteTarget] = useState<RecordingSummary | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const allRecordings = data ?? EMPTY_RECORDINGS;
  const recordings = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    // The picked calendar days become inclusive local-day instants, the same
    // bounds the server-side date filters send (`dateRangeToInstantBounds`).
    const bounds = dateRangeToInstantBounds(dateRange);
    const fromMs = bounds.from ? Date.parse(bounds.from) : null;
    const toMs = bounds.to ? Date.parse(bounds.to) : null;

    return allRecordings.filter(recording => {
      if (fromMs !== null || toMs !== null) {
        const startedMs = Date.parse(recording.startedAt);
        if (fromMs !== null && startedMs < fromMs) return false;
        if (toMs !== null && startedMs > toMs) return false;
      }
      if (!query) return true;
      return [recording.employee.name, recording.employee.role ?? '', formatDateTime(recording.startedAt)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [allRecordings, dateRange, debouncedSearch]);

  // The SESSION header's calendar popover (Figma 744-40363, same control as the
  // Logs date column): session-date sort + range. The sort half writes into the
  // shared `sorting` state, so it and the DURATION header toggle stay mutually
  // exclusive like any two sorted columns.
  const sessionSortDirection: 'asc' | 'desc' =
    sorting[0]?.id === REMOTE_SESSION_COLUMNS.session.id && !sorting[0].desc ? 'asc' : 'desc';
  const handleDateFilterApply = useCallback((result: DateFilterResult) => {
    setDateRange(result.range);
    setSorting([{ id: REMOTE_SESSION_COLUMNS.session.id, desc: result.sort === 'desc' }]);
  }, []);
  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection: sessionSortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [sessionSortDirection, dateRange, handleDateFilterApply],
  );

  // EMPLOYEE header funnel options - the technicians present in this device's
  // list (the rows carry no employee ids, so the name doubles as the value; the
  // filterFn compares it against the employee cell's accessor value).
  const employeeOptions = useMemo(() => {
    const names = [...new Set(allRecordings.map(recording => recording.employee.name))].sort();
    return names.map(name => ({ id: name, value: name, label: name }));
  }, [allRecordings]);

  // The mobile FilterModal (Figma 758-46869) and the desktop header funnels are
  // two views over the SAME columnFilters state, bridged between TanStack's
  // array shape and the modal's `Record<columnId, selectedIds>` shape.
  const modalFilterGroups = useMemo(
    () => [
      { id: REMOTE_SESSION_COLUMNS.employee.id, title: 'Employee', options: employeeOptions },
      { id: REMOTE_SESSION_COLUMNS.expires.id, title: 'Expires', options: EXPIRES_FILTER_OPTIONS },
    ],
    [employeeOptions],
  );
  const modalFilters = useMemo(() => {
    const filters: Record<string, string[]> = {};
    for (const filter of columnFilters) {
      if (Array.isArray(filter.value) && filter.value.length > 0) filters[filter.id] = filter.value as string[];
    }
    return filters;
  }, [columnFilters]);
  const handleModalFilterChange = useCallback((filters: Record<string, string[]>) => {
    setColumnFilters(MODAL_FILTER_IDS.flatMap(id => (filters[id]?.length ? [{ id, value: filters[id] }] : [])));
  }, []);

  // Everything sortable on the desktop header is sortable in the modal too -
  // the same `sorting` state, so a direction picked here lights the header
  // arrow when the viewport grows (pattern from `invoices-history.tsx`).
  // Session is NOT in this list: its sort rides the date section below, the
  // same way the desktop header keeps it inside the calendar popover.
  const modalSortConfig = useMemo(
    () => ({
      columns: [{ key: REMOTE_SESSION_COLUMNS.duration.id, label: 'Duration' }],
      sortBy: sorting[0]?.id,
      sortDirection: sorting[0] ? ((sorting[0].desc ? 'desc' : 'asc') as SortDirection) : undefined,
    }),
    [sorting],
  );
  const handleModalSort = useCallback((columnId: string, direction: SortDirection) => {
    setSorting([{ id: columnId, desc: direction === 'desc' }]);
  }, []);
  const handleModalSortClear = useCallback(() => setSorting([]), []);

  const columns = useMemo<ColumnDef<RecordingSummary>[]>(
    () =>
      remoteSessionColumns({
        dateFilter,
        employeeOptions,
        now,
        onOpen: row => {
          const href = recordingHref(row);
          if (href) router.push(href);
        },
        onDelete: setDeleteTarget,
      }),
    [dateFilter, employeeOptions, now, router],
  );

  const table = useDataTable<RecordingSummary>({
    data: recordings,
    columns,
    getRowId: (row: RecordingSummary) => row.id,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  // The header only draws the indicator - the consumer owns the toggle cycle
  // (same pattern as the Vulnerabilities tab). TanStack's row model applies the
  // actual client-side sort from the `sorting` state.
  const sortState = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;
  const handleSortChange = useCallback((columnId: string) => {
    setSorting(prev => {
      const current = prev[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  }, []);

  if (!deviceId) {
    return (
      <TabEmptyState
        icon={<ComputerMouseIcon />}
        title="No remote sessions"
        description="Recorded remote sessions for this device will appear here."
      />
    );
  }

  if (!isLoading && allRecordings.length === 0) {
    return (
      <TabEmptyState
        icon={<ComputerMouseIcon />}
        title="No remote sessions"
        description="Recorded remote sessions for this device will appear here."
      />
    );
  }

  // A narrowed-empty result keeps its controls reachable: the search box (to
  // clear the query) and the header (its calendar is the only way to clear an
  // applied date range). Only a genuinely empty list drops them.
  const hasSearch = debouncedSearch.trim().length > 0;
  const isNarrowed = hasSearch || dateRange !== undefined;
  const isEmpty = recordings.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {(!isEmpty || isNarrowed || isLoading) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          {/* showDropdown={false}: the input filters the table below - the
              component's own suggestions dropdown ("No results found") makes
              no sense here. */}
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search for Remote Session"
              showDropdown={false}
            />
          </div>
          {/* On mobile the column funnels are gone with the header cells - the
              standard filters button beside the search opens them as a modal
              (Figma 758-46869, same pattern as the schedule-runs toolbar). */}
          <Button
            variant="outline"
            size="icon"
            className="content-md:hidden"
            onClick={() => setMobileFilterOpen(true)}
            aria-label="Open filters"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        </div>
      )}

      <DataTable table={table}>
        {(isLoading || !isEmpty || dateRange !== undefined) && (
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            sort={sortState}
            onSortChange={handleSortChange}
            // The results count at the right edge of the header row, per the
            // mockup - counts the table's row model, so search and the
            // employee funnel both narrow it.
            rightSlot={<DataTable.RowCount itemName="result" />}
          />
        )}
        <DataTable.Body
          loading={isLoading}
          skeletonRows={4}
          rowClassName="mb-1"
          rowHref={recordingHref}
          emptyState={{
            icon: <ComputerMouseIcon />,
            title: 'No remote sessions found',
            description: debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : dateRange
                ? 'No sessions in the selected date range.'
                : 'Recorded remote sessions for this device will appear here.',
          }}
        />
      </DataTable>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filterGroups={modalFilterGroups}
        currentFilters={modalFilters}
        onFilterChange={handleModalFilterChange}
        sortConfig={modalSortConfig}
        onSort={handleModalSort}
        onSortClear={handleModalSortClear}
        // The SESSION calendar is a desktop header control - on mobile the same
        // session-date sort + range live here, drafted with the other filters.
        // Section order (sort -> groups -> date) is FilterModal's own, shared
        // with every other consumer.
        dateFilter={{
          title: 'Session',
          sort: sessionSortDirection,
          range: dateRange,
          onChange: handleDateFilterApply,
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Recording"
        description={
          <>
            Are you sure you want to delete the session recording from{' '}
            <span className="font-medium text-ods-accent">
              {deleteTarget ? formatDateTime(deleteTarget.startedAt) : ''}
            </span>
            ? This cannot be undone.
          </>
        }
        confirmLabel="Delete Recording"
        variant="destructive"
        isPending={deleteRecording.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRecording.mutate(
            { sessionId: deleteTarget.id, recordingId: deleteTarget.recordingId },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </div>
  );
}
