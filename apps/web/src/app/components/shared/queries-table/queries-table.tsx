'use client';

import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
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
import { LiveTable } from '../live-table';
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
        cell: ({ row }: { row: Row<QueryTableRow> }) => (
          <div className="flex min-h-[60px] min-w-0 flex-col justify-center gap-1 py-2">
            <TruncateText>{row.original.name}</TruncateText>
            {row.original.description && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.description}
              </TruncateText>
            )}
          </div>
        ),
        meta: { width: 'flex-1 min-w-0' },
      },
      {
        accessorKey: 'frequencyLabel',
        header: 'Frequency',
        cell: ({ row }: { row: Row<QueryTableRow> }) => (
          <span className="font-medium leading-[20px] text-ods-text-primary">{row.original.frequencyLabel}</span>
        ),
        meta: { width: 'w-[120px]', hideAt: 'md' },
      },
    ];

    if (hasActions) {
      cols.push({
        id: 'actions',
        header: '',
        cell: ({ row }: { row: Row<QueryTableRow> }) =>
          row.original.actions && row.original.actions.length > 0 ? (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
              <MoreActionsMenu items={row.original.actions} />
            </div>
          ) : null,
        enableSorting: false,
        meta: { width: 'w-12 content-md:w-auto content-md:min-w-[100px] shrink-0 flex-none', align: 'right' },
      });
    }

    cols.push({
      id: 'open',
      header: '',
      cell: ({ row }: { row: Row<QueryTableRow> }) =>
        row.original.href ? (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={openInNewTab(row.original.href)}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label={`Open ${row.original.name}`}
              className="bg-ods-card"
            />
          </div>
        ) : null,
      enableSorting: false,
      meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
    });

    return cols;
  }, [hasActions]);

  const table = useDataTable<QueryTableRow>({
    data: rows,
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
      />
    </LoadingWhen>
  );
}
