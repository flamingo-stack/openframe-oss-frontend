'use client';

import { Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
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
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { multiColumnFilter } from '../shared/column-filters';
import { OpenRowButton } from '../shared/open-row-button';
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

/** The Software Actions rows — suspends on the query, so it lives under the view's `<Suspense>`. */
export function SoftwareActionsTable({
  backendFilters,
  debouncedSearch,
  selections,
  onSelectionsChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareActionsTableProps) {
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

  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);

  const table = useDataTable<SoftwareActionRow>({
    data: rows,
    columns: buildColumns(filterOptions),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table (its own "no match"
  // row); a tenant with no run at all gets the page's empty state instead.
  const showEmptyState = !debouncedSearch && !backendFilters && !isPending && rows.length === 0;

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
    // Dim (don't unmount) the stale rows while a deferred refetch is in flight.
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
        />
        <DataTable.Body
          skeletonRows={SOFTWARE_ACTIONS_PAGE_SIZE}
          emptyState={{
            title: debouncedSearch
              ? `No software actions found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No software actions match the selected filters. Try adjusting your filters.',
          }}
          rowClassName="mb-1"
          rowHref={detailsHref}
        />
        {/* Zero rows plus a next page: see vulnerability-list-table.tsx. */}
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={fetchNextPage}
            skeletonRows={2}
          />
        )}
      </DataTable>
    </div>
  );
}
