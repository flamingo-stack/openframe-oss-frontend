'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ArrowRightUpIcon, Ellipsis01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  LoadingWhen,
  MoreActionsMenu,
  type NoDataProps,
  type Row,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo } from 'react';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { LiveTable, loadingPlaceholderRows } from '../live-table';
import type { InfiniteScroll } from '../no-next-page';
import type { QueryTableRow } from './query-table-row';

/** Schedule interval (seconds) → human label. Matches the /monitoring queries view. */
export function formatQueryInterval(seconds: number): string {
  if (seconds === 0) return 'Manual';
  if (seconds < 60) return `Every ${seconds}s`;
  if (seconds < 3600) return `Every ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `Every ${Math.floor(seconds / 3600)}h`;
  return `Every ${Math.floor(seconds / 86400)}d`;
}

interface QueriesTableBaseProps {
  rows: QueryTableRow[];
  /** The rows are a client read that has not answered: the table draws its own loading state. */
  isLoading?: boolean;
  /** What the body says when there are no rows (icon + title + description). */
  emptyState?: NoDataProps;
  /** Make each row a link to its `href`. */
  rowAsLink?: boolean;
  /** Pins the column header below the page's sticky toolbar. */
  stickyHeaderOffset?: string;
  /** Show the row count at the header's right edge. Default `false`. */
  showRowCount?: boolean;
}

/** A list revealed page by page (`pageSize`, its next page) or shown whole (`skeletonRows`, its typical count). */
export type QueriesTableProps = QueriesTableBaseProps &
  (
    | {
        /** The list's page size: the loading table and the next page draw that many rows, never a fold. */
        pageSize: number;
        skeletonRows?: never;
        /** The next page. */
        infiniteScroll?: InfiniteScroll;
      }
    | {
        /** The typical row count of a list shown whole: the loading table draws that many rows. */
        skeletonRows: number;
        pageSize?: never;
        infiniteScroll?: never;
      }
  );

/**
 * Shared queries table. Renders a normalized `QueryTableRow[]` with a consistent
 * column set (Query name+description, Frequency, optional row actions,
 * open-in-new-tab). Used by both the fleet-wide monitoring page and the
 * per-device Queries tab.
 */
export function QueriesTable({
  rows,
  isLoading: isLoadingProp = false,
  emptyState,
  rowAsLink = false,
  stickyHeaderOffset,
  showRowCount = false,
  pageSize,
  skeletonRows,
  infiniteScroll,
}: QueriesTableProps) {
  const isLoading = useLoadingScope() || isLoadingProp;
  // Reserve the actions column while loading so the column count stays stable across
  // skeleton → loading → loaded (otherwise it appears once rows arrive and shifts every
  // column — the "jitter"). Loaded rows in every caller carry actions.
  const hasActions = useMemo(() => isLoading || rows.some(r => r.actions && r.actions.length > 0), [isLoading, rows]);

  const columns = useMemo<ColumnDef<QueryTableRow>[]>(() => {
    const cols: ColumnDef<QueryTableRow>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }: { row: Row<QueryTableRow> }) => <QueryNameCell row={row.original} />,
        meta: { width: 'flex-1 min-w-0' },
      },
      {
        accessorKey: 'frequencyLabel',
        header: 'Frequency',
        cell: ({ row }: { row: Row<QueryTableRow> }) => <QueryFrequencyCell row={row.original} />,
        meta: { width: 'w-[120px]', hideAt: 'md' },
      },
    ];

    if (hasActions) {
      cols.push({
        id: 'actions',
        header: '',
        cell: ({ row }: { row: Row<QueryTableRow> }) => <QueryActionsCell row={row.original} />,
        enableSorting: false,
        meta: { width: 'w-12 content-md:w-auto content-md:min-w-[100px] shrink-0 flex-none', align: 'right' },
      });
    }

    cols.push({
      id: 'open',
      header: '',
      cell: ({ row }: { row: Row<QueryTableRow> }) => <QueryOpenCell row={row.original} />,
      enableSorting: false,
      meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
    });

    return cols;
  }, [hasActions]);

  // While loading the table holds one page of placeholder rows, drawn with the real cells.
  const loadingCount = pageSize ?? skeletonRows;
  const loadingRows = useMemo(
    () => (isLoading ? loadingPlaceholderRows<QueryTableRow>(loadingCount) : null),
    [isLoading, loadingCount],
  );

  const table = useDataTable<QueryTableRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: (row: QueryTableRow) => row.id,
    enableSorting: false,
  });

  const rowHref = useCallback((row: QueryTableRow) => (rowAsLink ? row.href : undefined), [rowAsLink]);

  // Hide the column header on the empty state — only show it while loading (skeleton rows)
  // or when there are real rows.
  const showHeader = isLoading || rows.length > 0;

  return (
    <LoadingWhen loading={isLoading}>
      <LiveTable
        table={table}
        {...(pageSize === undefined ? { skeletonRows } : { pageSize })}
        stickyHeaderOffset={stickyHeaderOffset}
        showHeader={showHeader}
        showRowCount={showRowCount}
        emptyState={emptyState}
        rowHref={rowHref}
        footer={infiniteScroll?.hasNextPage ? infiniteScroll : null}
        loadingCells={isLoading}
      />
    </LoadingWhen>
  );
}

/** The query's name over its description; both draw their bars while the row is read. */
function QueryNameCell({ row }: { row: QueryTableRow }) {
  const loading = useLoadingScope() && !row.name;
  return (
    <div className="flex min-h-[60px] min-w-0 flex-col justify-center gap-1 py-2">
      <TruncateText>{row.name ?? ''}</TruncateText>
      {(row.description || loading) && (
        <TruncateText variant="h6" tone="secondary">
          {row.description ?? ''}
        </TruncateText>
      )}
    </div>
  );
}

/** How often the query runs; a bar while the row is read. */
function QueryFrequencyCell({ row }: { row: QueryTableRow }) {
  if (useLoadingScope() && !row.frequencyLabel) return <TextLineSkeleton type="h4" className="w-16" />;
  return <span className="font-medium leading-[20px] text-ods-text-primary">{row.frequencyLabel}</span>;
}

/** The row's actions menu. While the row is read its trigger is drawn real, and inert. */
function QueryActionsCell({ row }: { row: QueryTableRow }) {
  const loading = useLoadingScope() && !row.name;
  if (!loading && !(row.actions && row.actions.length > 0)) return null;
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
      {loading ? (
        <Button
          variant="outline"
          size="icon"
          className="flex items-center justify-center border-ods-border bg-ods-card"
          aria-label="More actions"
          disabled
          leftIcon={<Ellipsis01Icon size={24} className="text-ods-text-primary" />}
        />
      ) : (
        <MoreActionsMenu items={row.actions ?? []} />
      )}
    </div>
  );
}

/** Opens the query in a new tab. While the row is read the button is drawn real, and inert. */
function QueryOpenCell({ row }: { row: QueryTableRow }) {
  const loading = useLoadingScope() && !row.name;
  if (!loading && !row.href) return null;
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading || !row.href ? undefined : openInNewTab(row.href)}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={loading ? 'Open' : `Open ${row.name}`}
        className="bg-ods-card"
        disabled={loading}
      />
    </div>
  );
}
