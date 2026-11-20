'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  type ColumnDef,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type {
  CursorPagerFooterProps,
  CursorPagerVariables,
  UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  SoftwareActionFilterInput,
  softwareActionsTableQuery as SoftwareActionsTableQueryType,
  softwareActionsTableQuery$data,
} from '@/__generated__/softwareActionsTableQuery.graphql';
import { EmptyState, liveColumnMeta, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { openRowColumn } from '@/app/components/shared/open-row-column';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { multiColumnFilter } from '../shared/column-filters';
import { SoftwareActionEngineCell } from './software-action-engine-cell';
import { SoftwareActionNameCell, SoftwareActionNameGridCell } from './software-action-name-cell';
import { SoftwareActionProcessedCell } from './software-action-processed-cell';
import { SoftwareActionStatusCell, SoftwareActionStatusGridCell } from './software-action-status-cell';
import { SoftwareActionTypeCell, SoftwareActionTypeGridCell } from './software-action-type-cell';
import { SOFTWARE_ACTION_COLUMNS, SOFTWARE_ACTIONS_PAGE_SIZE } from './software-actions-columns';
import { type SoftwareActionFilterOptions, useSoftwareActionFilters } from './use-software-action-filters';

/**
 * Software → Software Actions: one row per install/update of one package across
 * its target devices — the runs already dispatched plus the ones a schedule has
 * yet to fire (the backend lists those first). Search and the three funnels go
 * to the server; the list keeps the backend's own order, newest first. One page
 * at a time, its cursor in the URL (no `@connection`: a cursor from a link must
 * read exactly its page).
 */
const softwareActionsTableQuery = graphql`
  query softwareActionsTableQuery($filter: SoftwareActionFilterInput, $search: String, $first: Int!, $after: String) {
    softwareActions(filter: $filter, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          id
          # Package name — the backend has no display name for a run.
          software
          # What the funnels narrow the rows on screen by, while the refetch
          # they triggered is still in flight. status also says whether a row
          # has anything to open yet (see detailsHref).
          kind
          engine
          status
          ...softwareActionNameCell_action
          ...softwareActionTypeCell_action
          ...softwareActionEngineCell_action
          ...softwareActionStatusCell_action
          ...softwareActionProcessedCell_action
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

type SoftwareActionRow = NonNullable<softwareActionsTableQuery$data['softwareActions']>['edges'][number]['node'];

/** The selection of each funnel, keyed by its column id — the shape the URL keeps. */
export interface SoftwareActionSelections {
  action: string[];
  engine: string[];
  status: string[];
}

/**
 * Software Update Details of this one run — or null for a row still waiting on
 * its schedule: its id is synthetic until it fires, with no run behind it to
 * open.
 */
function detailsHref(row: SoftwareActionRow): string | null {
  return row.status === SoftwareActionStatus.SCHEDULED ? null : routes.software.action(row.id);
}

/** The columns, with each funnel offering exactly the values the tenant's runs have. */
function buildColumns(options: SoftwareActionFilterOptions): ColumnDef<SoftwareActionRow>[] {
  return [
    {
      id: SOFTWARE_ACTION_COLUMNS.software.id,
      header: SOFTWARE_ACTION_COLUMNS.software.header,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionNameCell action={row.original} />,
      enableSorting: false,
      size: 320,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.software, {
        gridCell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionNameGridCell action={row.original} />,
      }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.action.id,
      header: SOFTWARE_ACTION_COLUMNS.action.header,
      accessorFn: (row: SoftwareActionRow) => row.kind,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionTypeCell action={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 260,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.action, {
        filter: { options: options.actions },
        gridCell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionTypeGridCell action={row.original} />,
      }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.engine.id,
      header: SOFTWARE_ACTION_COLUMNS.engine.header,
      accessorFn: (row: SoftwareActionRow) => row.engine,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionEngineCell action={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 200,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.engine, { filter: { options: options.engines } }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.status.id,
      header: SOFTWARE_ACTION_COLUMNS.status.header,
      accessorFn: (row: SoftwareActionRow) => row.status,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionStatusCell action={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 340,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.status, {
        filter: { options: options.statuses },
        gridCell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionStatusGridCell action={row.original} />,
      }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.processedDevices.id,
      header: SOFTWARE_ACTION_COLUMNS.processedDevices.header,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionProcessedCell action={row.original} />,
      enableSorting: false,
      size: 220,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.processedDevices, { label: 'Processed devices' }),
    },
    // A run still waiting on its schedule has nothing to open: no button, as in its card row.
    openRowColumn<SoftwareActionRow>(SOFTWARE_ACTION_COLUMNS.open, row => {
      const href = detailsHref(row);
      return href ? { label: `Open ${row.software} in new tab`, href } : null;
    }),
  ];
}

const getRowId = (row: SoftwareActionRow) => row.id;

interface SoftwareActionsTableProps {
  /** Deferred funnel selection — feeds the query (lags the live funnels during a refetch). */
  backendFilters: SoftwareActionFilterInput | null;
  debouncedSearch: string;
  /** Live funnel selection — what the headers draw as ticked, so a tick lands instantly. */
  selections: SoftwareActionSelections;
  onSelectionsChange: (next: SoftwareActionSelections) => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** No run at all (not a search or funnel miss) — the view drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/** The filter options before the query has read them (the loading state's): none known yet. */
const UNREAD_FILTER_OPTIONS: SoftwareActionFilterOptions = { actions: [], engines: [], statuses: [] };

/**
 * The Software Actions rows, with their own boundary. In a loading scope (the boundary's fallback, or the module's flag
 * window) the reader draws the table over one page of placeholder rows with their real cells, each in its own loading
 * form; otherwise it runs the query, which suspends under that boundary.
 */
export function SoftwareActionsTable(props: SoftwareActionsTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <SoftwareActionsTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function SoftwareActionsTableLoading(props: SoftwareActionsTableProps) {
  return (
    <LoadingSuspense label="Loading software actions">
      <SoftwareActionsTableReader {...props} />
    </LoadingSuspense>
  );
}

function SoftwareActionsTableReader(props: SoftwareActionsTableProps) {
  if (useLoadingScope()) {
    return (
      <SoftwareActionsRows
        {...props}
        rows={NO_ITEMS}
        totalCount={0}
        filterOptions={UNREAD_FILTER_OPTIONS}
        pager={null}
      />
    );
  }
  return <SoftwareActionsTableQuery {...props} />;
}

function SoftwareActionsTableQuery(props: SoftwareActionsTableProps) {
  const { backendFilters, debouncedSearch, isPending, pager, pageVariables } = props;
  const retryKey = useRetryKey();
  const variables = {
    filter: backendFilters,
    search: debouncedSearch || null,
    ...forwardPage(pageVariables, SOFTWARE_ACTIONS_PAGE_SIZE),
  };
  const data = useLazyLoadQuery<SoftwareActionsTableQueryType>(softwareActionsTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<SoftwareActionsTableQueryType>(softwareActionsTableQuery, variables);

  const rows = (data.softwareActions?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwareActions?.filteredCount ?? rows.length;
  const paged = usePagedTable({
    pager,
    pageInfo: data.softwareActions?.pageInfo,
    rowCount: rows.length,
    refetch,
    isPending,
  });

  // The funnels' options: what actually occurs across the tenant's runs, from
  // the server, so a value no run has is never offered.
  const filterOptions = useSoftwareActionFilters();

  return (
    <SoftwareActionsRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      filterOptions={filterOptions}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

interface SoftwareActionsRowsProps extends Omit<SoftwareActionsTableProps, 'pager' | 'pageVariables'> {
  rows: readonly SoftwareActionRow[];
  totalCount: number;
  filterOptions: SoftwareActionFilterOptions;
  /** The First · Prev · Next footer (`usePagedTable`); `null` while the first page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker in the header (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function SoftwareActionsRows({
  rows,
  totalCount,
  filterOptions,
  pager,
  refresh,
  backendFilters,
  debouncedSearch,
  selections,
  onSelectionsChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareActionsRowsProps) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('software-actions');
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);
  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<SoftwareActionRow>(SOFTWARE_ACTIONS_PAGE_SIZE) : null),
    [loading],
  );

  const table = useDataTable<SoftwareActionRow>({
    // The table only ever reads the page it is handed.
    data: placeholderRows ?? (rows as SoftwareActionRow[]),
    columns: buildColumns(filterOptions),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table (its own "no match"
  // row); a tenant with no run at all gets the page's empty state instead. An empty LATER page keeps the table, so
  // First stays reachable.
  const showEmptyState =
    !loading && !debouncedSearch && !backendFilters && !isPending && rows.length === 0 && (pager?.isFirstPage ?? true);

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<Refresh02HrIcon />}
        title="No software actions yet"
        description="Install and update runs across your fleet, and the ones scheduled to run, will be listed here."
      />
    );
  }

  return (
    <LiveTable
      {...tableGrid}
      table={table}
      pageSize={SOFTWARE_ACTIONS_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      isPending={isPending}
      emptyState={oneLineEmptyState(
        debouncedSearch
          ? `No software actions found matching "${debouncedSearch}". Try adjusting your search.`
          : 'No software actions match the selected filters. Try adjusting your filters.',
      )}
      rowHref={detailsHref}
      pager={pager}
      refresh={refresh}
    />
  );
}
