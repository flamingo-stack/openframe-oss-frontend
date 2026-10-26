'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  type Row,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  softwareActionsTable_query$data,
  softwareActionsTable_query$key,
} from '@/__generated__/softwareActionsTable_query.graphql';
import type { softwareActionsTablePaginationQuery as SoftwareActionsTablePaginationQueryType } from '@/__generated__/softwareActionsTablePaginationQuery.graphql';
import type {
  SoftwareActionFilterInput,
  softwareActionsTableQuery as SoftwareActionsTableQueryType,
} from '@/__generated__/softwareActionsTableQuery.graphql';
import {
  EmptyState,
  type InfiniteScroll,
  liveColumnMeta,
  NO_ITEMS,
  NO_NEXT_PAGE,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { multiColumnFilter } from '../shared/column-filters';
import { SoftwareActionEngineCell } from './software-action-engine-cell';
import { SoftwareActionProcessedCell } from './software-action-processed-cell';
import { SoftwareActionStatusCell } from './software-action-status-cell';
import { SoftwareActionTypeCell } from './software-action-type-cell';
import { SOFTWARE_ACTION_COLUMNS, SOFTWARE_ACTIONS_PAGE_SIZE } from './software-actions-columns';
import { type SoftwareActionFilterOptions, useSoftwareActionFilters } from './use-software-action-filters';

/**
 * Software → Software Actions: one row per install/update of one package across
 * its target devices — the runs already dispatched plus the ones a schedule has
 * yet to fire (the backend lists those first). Search and the three funnels go
 * to the server; the list keeps the backend's own order, newest first.
 */
const softwareActionsTableQuery = graphql`
  query softwareActionsTableQuery($filter: SoftwareActionFilterInput, $search: String, $first: Int!, $after: String) {
    ...softwareActionsTable_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

const softwareActionsTableFragment = graphql`
  fragment softwareActionsTable_query on Query
  @refetchable(queryName: "softwareActionsTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "SoftwareActionFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareActions(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "softwareActionsTable_softwareActions") {
      filteredCount
      edges {
        node {
          id
          # Package name — the backend has no display name for a run.
          software
          # What the funnels narrow the rows on screen by, while the refetch
          # they triggered is still in flight. status also says whether a row
          # has anything to open yet (see detailsHref).
          action
          engine
          status
          ...softwareActionTypeCell_action
          ...softwareActionEngineCell_action
          ...softwareActionStatusCell_action
          ...softwareActionProcessedCell_action
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type SoftwareActionRow = NonNullable<softwareActionsTable_query$data['softwareActions']>['edges'][number]['node'];

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
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <TruncateText>{row.original.software}</TruncateText>,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.software),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.action.id,
      header: SOFTWARE_ACTION_COLUMNS.action.header,
      accessorFn: (row: SoftwareActionRow) => row.action,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionTypeCell action={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.action, { filter: { options: options.actions } }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.engine.id,
      header: SOFTWARE_ACTION_COLUMNS.engine.header,
      accessorFn: (row: SoftwareActionRow) => row.engine,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionEngineCell action={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.engine, { filter: { options: options.engines } }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.status.id,
      header: SOFTWARE_ACTION_COLUMNS.status.header,
      accessorFn: (row: SoftwareActionRow) => row.status,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionStatusCell action={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.status, { filter: { options: options.statuses } }),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.processedDevices.id,
      header: SOFTWARE_ACTION_COLUMNS.processedDevices.header,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => <SoftwareActionProcessedCell action={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.processedDevices),
    },
    {
      id: SOFTWARE_ACTION_COLUMNS.open.id,
      cell: ({ row }: { row: Row<SoftwareActionRow> }) => {
        const href = detailsHref(row.original);
        if (!href) return null;
        return <OpenRowButton label={`Open ${row.original.software} in new tab`} onClick={openInNewTab(href)} />;
      },
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_ACTION_COLUMNS.open),
    },
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
        infiniteScroll={NO_NEXT_PAGE}
      />
    );
  }
  return <SoftwareActionsTableQuery {...props} />;
}

function SoftwareActionsTableQuery(props: SoftwareActionsTableProps) {
  const { backendFilters, debouncedSearch } = props;
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareActionsTableQueryType>(
    softwareActionsTableQuery,
    { filter: backendFilters, search: debouncedSearch || null, first: SOFTWARE_ACTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareActionsTablePaginationQueryType,
    softwareActionsTable_query$key
  >(softwareActionsTableFragment, queryData);

  const rows = (data.softwareActions?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwareActions?.filteredCount ?? rows.length;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_ACTIONS_PAGE_SIZE);
  };

  // The funnels' options: what actually occurs across the tenant's runs, from
  // the server, so a value no run has is never offered.
  const filterOptions = useSoftwareActionFilters();

  return (
    <SoftwareActionsRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      filterOptions={filterOptions}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

interface SoftwareActionsRowsProps extends SoftwareActionsTableProps {
  rows: readonly SoftwareActionRow[];
  totalCount: number;
  filterOptions: SoftwareActionFilterOptions;
  infiniteScroll: InfiniteScroll;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function SoftwareActionsRows({
  rows,
  totalCount,
  filterOptions,
  infiniteScroll,
  backendFilters,
  debouncedSearch,
  selections,
  onSelectionsChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareActionsRowsProps) {
  const loading = useLoadingScope();
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
  // row); a tenant with no run at all gets the page's empty state instead.
  const showEmptyState = !loading && !debouncedSearch && !backendFilters && !isPending && rows.length === 0;

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
      table={table}
      pageSize={SOFTWARE_ACTIONS_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      isPending={isPending}
      emptyState={{
        title: debouncedSearch
          ? `No software actions found matching "${debouncedSearch}". Try adjusting your search.`
          : 'No software actions match the selected filters. Try adjusting your filters.',
      }}
      rowHref={detailsHref}
      // Zero rows plus a next page: see vulnerability-table.tsx.
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}
