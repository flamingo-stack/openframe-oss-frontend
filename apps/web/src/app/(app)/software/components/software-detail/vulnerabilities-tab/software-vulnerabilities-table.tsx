'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { BracketSquareCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  type ColumnDef,
  type DataTableSortState,
  type Row,
  TruncateText,
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
  softwareVulnerabilitiesTableQuery as SoftwareVulnerabilitiesTableQueryType,
  softwareVulnerabilitiesTableQuery$data,
  SortInput,
} from '@/__generated__/softwareVulnerabilitiesTableQuery.graphql';
import { EmptyState, liveColumnMeta, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { openRowColumn } from '@/app/components/shared/open-row-column';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { routes } from '@/lib/routes';
import { SOFTWARE_VULNERABILITIES_PAGE_SIZE, SOFTWARE_VULNERABILITY_COLUMNS } from './software-vulnerabilities-columns';
import {
  SoftwareVulnerabilityDiscoveredCell,
  SoftwareVulnerabilityDiscoveredGridCell,
} from './software-vulnerability-discovered-cell';
import { SoftwareVulnerabilityVersionCell } from './software-vulnerability-version-cell';

/**
 * Software → Vulnerabilities: the CVEs matched to this title. One row per CVE
 * × affected fleet version — a CVE that hits several installed versions is
 * listed once per version — with when Fleet first found it. Search and the
 * Discovered sort only; no severity, which the scanner does not rate. A row
 * opens the CVE's own page; NVD is one click further, its "More Details".
 * One page at a time, its cursor in the URL (`cveCursor`; no `@connection`: a
 * cursor from a link must read exactly its page).
 */
const softwareVulnerabilitiesTableQuery = graphql`
  query softwareVulnerabilitiesTableQuery(
    $softwareId: ID!
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    softwareVulnerabilities(softwareId: $softwareId, search: $search, sort: $sort, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          cveId
          # The other half of the row key: the same CVE comes once per
          # affected version, and the cell below reads it through its own
          # fragment.
          affectedVersion
          ...softwareVulnerabilityVersionCell_vulnerability
          ...softwareVulnerabilityDiscoveredCell_vulnerability
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

type SoftwareVulnerabilityRow = NonNullable<
  softwareVulnerabilitiesTableQuery$data['softwareVulnerabilities']
>['edges'][number]['node'];

const COLUMNS: ColumnDef<SoftwareVulnerabilityRow>[] = [
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.cveId.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.cveId.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => <TruncateText>{row.original.cveId}</TruncateText>,
    enableSorting: false,
    size: 280,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.cveId),
  },
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <SoftwareVulnerabilityVersionCell vulnerability={row.original} />
    ),
    enableSorting: false,
    size: 220,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion),
  },
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <SoftwareVulnerabilityDiscoveredCell vulnerability={row.original} />
    ),
    enableSorting: false,
    size: 260,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt, {
      gridCell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
        <SoftwareVulnerabilityDiscoveredGridCell vulnerability={row.original} />
      ),
    }),
  },
  openRowColumn<SoftwareVulnerabilityRow>(SOFTWARE_VULNERABILITY_COLUMNS.open, row => ({
    label: `Open ${row.cveId} in new tab`,
    href: routes.software.vulnerability(row.cveId),
  })),
];

/**
 * A row is a CVE on one affected version; the CVE id alone repeats. `\0` cannot
 * occur in either half, so the pair can't collide with another. A loading
 * placeholder (`loadingPlaceholderRows`) has no CVE yet and keys on its own id.
 */
const getRowId = (row: SoftwareVulnerabilityRow) =>
  row.cveId ? `${row.cveId}\0${row.affectedVersion ?? ''}` : String((row as { id?: string }).id);
const rowHref = (row: SoftwareVulnerabilityRow) => (row.cveId ? routes.software.vulnerability(row.cveId) : null);

interface SoftwareVulnerabilitiesTableProps {
  softwareId: string;
  debouncedSearch: string;
  sort: SortInput | null;
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /** True while a refetch is in flight — guards the empty state so it never flashes on stale data. */
  isPending: boolean;
  /** Nothing matched to this title at all (not a search miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The URL prefix of the tab's params (its auto-refresh interval sits beside them). */
  paramPrefix: string;
}

/**
 * The tab's rows, with their own boundary. In a loading scope (the boundary's fallback, or the module's flag window)
 * the reader draws the table over one page of placeholder rows with their real cells, each in its own loading form;
 * otherwise it runs the query, which suspends under that boundary.
 */
export function SoftwareVulnerabilitiesTable(props: SoftwareVulnerabilitiesTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <SoftwareVulnerabilitiesTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function SoftwareVulnerabilitiesTableLoading(props: SoftwareVulnerabilitiesTableProps) {
  return (
    <LoadingSuspense label="Loading vulnerabilities">
      <SoftwareVulnerabilitiesTableReader {...props} />
    </LoadingSuspense>
  );
}

function SoftwareVulnerabilitiesTableReader(props: SoftwareVulnerabilitiesTableProps) {
  if (useLoadingScope()) {
    return <SoftwareVulnerabilitiesTableRows {...props} rows={NO_ITEMS} totalCount={0} pager={null} />;
  }
  return <SoftwareVulnerabilitiesTableQuery {...props} />;
}

function SoftwareVulnerabilitiesTableQuery(props: SoftwareVulnerabilitiesTableProps) {
  const { softwareId, debouncedSearch, sort, isPending, pager, pageVariables, paramPrefix } = props;
  const retryKey = useRetryKey();
  const variables = {
    softwareId,
    search: debouncedSearch || null,
    sort,
    ...forwardPage(pageVariables, SOFTWARE_VULNERABILITIES_PAGE_SIZE),
  };
  const data = useLazyLoadQuery<SoftwareVulnerabilitiesTableQueryType>(softwareVulnerabilitiesTableQuery, variables, {
    fetchPolicy: 'store-or-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<SoftwareVulnerabilitiesTableQueryType>(softwareVulnerabilitiesTableQuery, variables);

  const rows = (data.softwareVulnerabilities?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwareVulnerabilities?.filteredCount ?? rows.length;
  const paged = usePagedTable({
    pager,
    pageInfo: data.softwareVulnerabilities?.pageInfo,
    rowCount: rows.length,
    prefix: paramPrefix,
    refetch,
    isPending,
  });

  return (
    <SoftwareVulnerabilitiesTableRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

interface SoftwareVulnerabilitiesTableRowsProps extends Omit<
  SoftwareVulnerabilitiesTableProps,
  'pager' | 'pageVariables' | 'paramPrefix'
> {
  rows: readonly SoftwareVulnerabilityRow[];
  totalCount: number;
  /** The First · Prev · Next footer (`usePagedTable`); `null` while the first page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker in the header (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function SoftwareVulnerabilitiesTableRows({
  rows,
  totalCount,
  pager,
  refresh,
  debouncedSearch,
  sortState,
  onSortChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareVulnerabilitiesTableRowsProps) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('software-vulnerabilities');
  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<SoftwareVulnerabilityRow>(SOFTWARE_VULNERABILITIES_PAGE_SIZE) : null),
    [loading],
  );

  const table = useDataTable<SoftwareVulnerabilityRow>({
    // The table only ever reads the page it is handed.
    data: placeholderRows ?? (rows as SoftwareVulnerabilityRow[]),
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });

  // A search that finds nothing keeps the table (its own "no match" row); a
  // title with no CVEs at all gets the section's empty state instead. An empty LATER page keeps the table, so First
  // stays reachable.
  const showEmptyState =
    !loading && !debouncedSearch && !isPending && rows.length === 0 && (pager?.isFirstPage ?? true);

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<BracketSquareCheckIcon />}
        title="No known vulnerabilities"
        description="CVEs matched to this software will be listed here once the vulnerability scan reports them."
      />
    );
  }

  return (
    <LiveTable
      {...tableGrid}
      table={table}
      pageSize={SOFTWARE_VULNERABILITIES_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      sort={sortState}
      onSortChange={onSortChange}
      isPending={isPending}
      emptyState={oneLineEmptyState(
        `No vulnerabilities found matching "${debouncedSearch}". Try adjusting your search.`,
      )}
      rowHref={rowHref}
      pager={pager}
      refresh={refresh}
    />
  );
}
